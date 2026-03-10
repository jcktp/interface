"""AI Q&A Service — Agentic assistant powered by local Ollama via OpenAI-compatible API.

Architecture:
  1. INTENT DETECTION   — detect if question needs SQL or can be answered conversationally
  2. SQL GENERATION     — LLM converts NL question + conversation history → PostgreSQL
  3. SQL EXECUTION      — safe SELECT-only execution with 10s timeout
  4. SQL SELF-CORRECTION — on error, feed it back to LLM for one retry
  5. ANSWER GENERATION  — second LLM call produces natural-language answer from results
  6. CHART INFERENCE    — auto-selects chart type from result shape

Provider config (environment variables):
  LLM_BASE_URL   — OpenAI-compatible base URL (default: Ollama's /v1 endpoint)
  LLM_MODEL      — model name served at that URL (default: qwen2.5:7b)
  OPENAI_API_KEY — API key ("ollama" for local Ollama, real key for OpenAI)

  # --- PLACEHOLDER: swap to real OpenAI ---
  # LLM_BASE_URL=https://api.openai.com/v1
  # LLM_MODEL=gpt-4o-mini
  # OPENAI_API_KEY=sk-...
  # ----------------------------------------
"""

import os
import json
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple
from uuid import UUID, uuid4

from sqlalchemy.orm import Session
from sqlalchemy import text

from database.models import AIConversation, AIMessage


# ---------------------------------------------------------------------------
# LLM configuration from environment
# ---------------------------------------------------------------------------
LLM_BASE_URL = os.environ.get("LLM_BASE_URL", "http://ollama:11434/v1")
LLM_MODEL    = os.environ.get("LLM_MODEL",    "qwen2.5:7b")
LLM_API_KEY  = os.environ.get("OPENAI_API_KEY", "ollama")

HISTORY_WINDOW = 8   # number of past messages to include as context


# ---------------------------------------------------------------------------
# Database schema — given to the LLM so it can write accurate SQL
# ---------------------------------------------------------------------------
DB_SCHEMA = """
PostgreSQL database schema (HR Analytics):

TABLE employees
  id UUID, organization_id UUID, employee_id VARCHAR
  first_name VARCHAR, last_name VARCHAR, email VARCHAR
  department VARCHAR, job_title VARCHAR, location VARCHAR
  hire_date DATE, termination_date DATE (NULL if still employed)
  status ENUM('active','terminated','on_leave')
  salary FLOAT, age INT, tenure FLOAT (years)
  performance_rating FLOAT (1–5), engagement_score FLOAT (0–100)
  manager_id UUID (nullable)
  NOTE: there is NO review_date, last_review_date, or review column — do NOT use them

TABLE job_requisitions
  id UUID, organization_id UUID, title VARCHAR
  department VARCHAR, location VARCHAR
  status ENUM('open','closed','on_hold','cancelled')
  priority ENUM('low','medium','high','critical')
  open_date DATE, close_date DATE (nullable), target_hire_date DATE
  salary_min FLOAT, salary_max FLOAT

TABLE candidates
  id UUID, organization_id UUID
  first_name VARCHAR, last_name VARCHAR, email VARCHAR
  applied_position VARCHAR, department VARCHAR
  application_date DATE
  status ENUM('new','screening','interview','offer','hired','rejected')
  source VARCHAR, stage VARCHAR

TABLE attendance_records
  id UUID, organization_id UUID, employee_id UUID (FK → employees.id)
  date DATE, status ENUM('in_office','remote','absent','leave')

TABLE kpi_definitions
  id UUID, organization_id UUID, name VARCHAR, description TEXT
  category VARCHAR, unit VARCHAR, is_system BOOL

TABLE kpi_measurements
  id UUID, kpi_definition_id UUID (FK), organization_id UUID
  period_start DATE, period_end DATE, value FLOAT

RULES:
- ALWAYS filter by organization_id = :org_id (use the literal value, not a placeholder)
- Only SELECT statements are allowed — never INSERT/UPDATE/DELETE/DROP
- Use PostgreSQL syntax (EXTRACT, DATE_TRUNC, ROUND, NULLIF, etc.)
- Attrition/turnover rate = terminated_count * 100.0 / NULLIF(total_count, 0)
- engagement_score is 0–100 (not 0–5)
"""


def _llm_client():
    """Return an OpenAI-compatible client pointed at the configured provider."""
    import openai
    return openai.OpenAI(api_key=LLM_API_KEY, base_url=LLM_BASE_URL)


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------

class AIQAService:
    """Agentic AI assistant for natural-language queries over HR data."""

    def __init__(self, db: Session):
        self.db = db

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def ask(
        self,
        org_id: UUID,
        user_id: UUID,
        question: str,
        conversation_id: Optional[UUID] = None,
    ) -> Dict[str, Any]:
        print(f"[AI] Question: {question}")

        # Get or create conversation
        conversation = self._get_or_create_conversation(
            org_id, user_id, question, conversation_id
        )

        # Save user message
        self.db.add(AIMessage(
            id=uuid4(),
            conversation_id=conversation.id,
            organization_id=org_id,
            role="user",
            content=question,
            created_at=datetime.utcnow(),
        ))
        self.db.flush()

        # Load recent history for context
        history = self._load_history(conversation.id, org_id)

        # Route: let the LLM decide whether to query data, advise, or both
        intent = self._route_intent(question, history)
        print(f"[AI] Intent: {intent}")

        if intent == "chat":
            answer = self._chat_response(question, history, org_id)
            generated_sql, query_result, chart_config = None, None, None
        elif intent == "both":
            # Advisory + data: run data pipeline then enrich answer with advice
            generated_sql, query_result, answer, chart_config = self._data_pipeline(
                question, org_id, history
            )
            advice = self._advisory_addendum(question, query_result, history)
            if advice:
                answer = f"{answer}\n\n{advice}"
        else:  # "data"
            generated_sql, query_result, answer, chart_config = self._data_pipeline(
                question, org_id, history
            )

        # Save assistant message
        self.db.add(AIMessage(
            id=uuid4(),
            conversation_id=conversation.id,
            organization_id=org_id,
            role="assistant",
            content=answer,
            generated_sql=generated_sql,
            query_result=query_result,
            chart_config=chart_config,
            created_at=datetime.utcnow(),
        ))
        conversation.updated_at = datetime.utcnow()
        self.db.commit()

        return {
            "conversation_id": str(conversation.id),
            "answer": answer,
            "sql": generated_sql,
            "results": query_result,
            "chart_config": chart_config,
        }

    def get_conversations(self, org_id: UUID, user_id: UUID, limit: int = 20):
        convos = (
            self.db.query(AIConversation)
            .filter(
                AIConversation.organization_id == org_id,
                AIConversation.user_id == user_id,
            )
            .order_by(AIConversation.updated_at.desc())
            .limit(limit)
            .all()
        )
        return [
            {
                "id": str(c.id),
                "title": c.title,
                "created_at": c.created_at.isoformat(),
                "updated_at": c.updated_at.isoformat(),
            }
            for c in convos
        ]

    def get_messages(self, conversation_id: UUID, org_id: UUID):
        messages = (
            self.db.query(AIMessage)
            .filter(AIMessage.conversation_id == conversation_id)
            .order_by(AIMessage.created_at.asc())
            .all()
        )
        return [
            {
                "id": str(m.id),
                "role": m.role,
                "content": m.content,
                "sql": m.generated_sql,
                "results": m.query_result,
                "chart_config": m.chart_config,
                "created_at": m.created_at.isoformat(),
            }
            for m in messages
        ]

    # ------------------------------------------------------------------
    # Internal pipeline
    # ------------------------------------------------------------------

    def _data_pipeline(
        self, question: str, org_id: UUID, history: List[Dict]
    ) -> Tuple[Optional[str], Optional[List], str, Optional[Dict]]:
        """Full SQL → execute → answer pipeline with self-correction."""

        # Step 1: Generate SQL
        sql, error = self._generate_sql(question, org_id, history)
        if not sql:
            return None, None, error or "I wasn't able to turn that into a query. Could you rephrase it?", None

        print(f"[AI] Generated SQL: {sql}")

        if not self._validate_sql(sql):
            return sql, None, "For safety I can only run SELECT queries. Please rephrase.", None

        # Step 2: Execute
        results, exec_error = self._execute_sql(sql, org_id)

        # Step 3: Self-correction — one retry if SQL fails
        if exec_error:
            print(f"[AI] SQL error: {exec_error} — attempting self-correction")
            fixed_sql, _ = self._fix_sql(question, sql, exec_error, org_id)
            if fixed_sql and self._validate_sql(fixed_sql):
                results, exec_error = self._execute_sql(fixed_sql, org_id)
                if not exec_error:
                    sql = fixed_sql
                    print(f"[AI] Self-corrected SQL: {sql}")

        if exec_error:
            return sql, None, f"I generated a query but ran into a database error: {exec_error}", None

        print(f"[AI] Query returned {len(results) if results else 0} rows")

        # Step 4: Generate natural language answer via LLM
        answer, chart_config = self._generate_answer(question, sql, results, history)
        return sql, results, answer, chart_config

    # ------------------------------------------------------------------
    # LLM calls
    # ------------------------------------------------------------------

    def _generate_sql(
        self, question: str, org_id: UUID, history: List[Dict]
    ) -> Tuple[Optional[str], Optional[str]]:
        """Ask the LLM to convert a natural language question into SQL."""
        try:
            client = _llm_client()

            system = f"""You are an expert SQL generator for a PostgreSQL HR analytics database.

{DB_SCHEMA}

Your job: convert the user's question into a single valid PostgreSQL SELECT query.
- Output ONLY the raw SQL — no markdown, no code fences, no explanation.
- Always include: WHERE organization_id = '{org_id}'
- Limit results to 100 rows maximum unless the user asks for something specific.
- If the question is ambiguous, pick the most useful interpretation.
"""

            messages = [{"role": "system", "content": system}]

            # Include recent conversation turns as context
            for turn in history[-HISTORY_WINDOW:]:
                messages.append({"role": turn["role"], "content": turn["content"]})

            messages.append({"role": "user", "content": f"Question: {question}\nSQL:"})

            response = client.chat.completions.create(
                model=LLM_MODEL,
                messages=messages,
                temperature=0,
                max_tokens=600,
            )

            raw = response.choices[0].message.content.strip()
            sql = self._extract_sql(raw)
            return sql, None

        except Exception as e:
            print(f"[AI] SQL generation error: {e}")
            return self._fallback_sql(question, org_id)

    def _fix_sql(
        self, question: str, bad_sql: str, error: str, org_id: UUID
    ) -> Tuple[Optional[str], Optional[str]]:
        """Ask the LLM to fix a SQL query that produced an error."""
        try:
            client = _llm_client()
            prompt = f"""The following PostgreSQL query produced an error. Fix it.

Original question: {question}
Broken SQL:
{bad_sql}

Error: {error}

{DB_SCHEMA}

Return ONLY the corrected SQL query with no explanation."""

            response = client.chat.completions.create(
                model=LLM_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0,
                max_tokens=600,
            )
            raw = response.choices[0].message.content.strip()
            return self._extract_sql(raw), None
        except Exception as e:
            return None, str(e)

    def _generate_answer(
        self,
        question: str,
        sql: str,
        results: Optional[List[Dict]],
        history: List[Dict],
    ) -> Tuple[str, Optional[Dict]]:
        """Use the LLM to write a natural language answer from query results."""
        if results is None:
            return "I couldn't find any data matching that query.", None

        if not results:
            return "The query ran successfully but returned no data — the result set is empty for your current filters.", None

        chart_config = self._infer_chart(results)

        # Truncate large result sets for the LLM context
        sample = results[:40] if len(results) > 40 else results
        results_json = json.dumps(sample, default=str)

        try:
            client = _llm_client()

            system = """You are an HR analytics assistant. Given a user question, the SQL used to answer it, and the query results, write a clear, insightful response.

Guidelines:
- Be concise but informative. Use bullet points or bold text where helpful.
- Highlight key numbers, trends, outliers, or anomalies.
- If there are many rows, summarize rather than listing all.
- Do NOT mention SQL or technical details unless the user asks.
- Speak as if you are an HR business partner, not a database.
- If the data shows something noteworthy (high attrition, low engagement, etc.) briefly flag it."""

            messages = [{"role": "system", "content": system}]

            for turn in history[-4:]:
                messages.append({"role": turn["role"], "content": turn["content"]})

            messages.append({
                "role": "user",
                "content": (
                    f"Question: {question}\n\n"
                    f"Results ({len(results)} rows total, showing up to 40):\n{results_json}\n\n"
                    "Please provide a clear, helpful answer."
                ),
            })

            response = client.chat.completions.create(
                model=LLM_MODEL,
                messages=messages,
                temperature=0.3,
                max_tokens=600,
            )

            answer = response.choices[0].message.content.strip()
            return answer, chart_config

        except Exception as e:
            print(f"[AI] Answer generation error: {e}")
            # Fall back to template summary
            return self._template_summary(question, results), chart_config

    def _chat_response(self, question: str, history: List[Dict], org_id: UUID) -> str:
        """Handle advisory, strategic, and conversational questions."""
        try:
            client = _llm_client()

            system = """You are an expert HR Business Partner and People Analytics advisor embedded in an HR analytics platform.

Your expertise covers:
- Workforce planning and headcount strategy
- Attrition analysis and retention programs
- Compensation benchmarking and pay equity
- Employee engagement and performance management
- Diversity, equity, and inclusion metrics
- Recruitment funnel optimization and time-to-hire
- HR metrics that matter to C-suite and board stakeholders
- Presenting HR data as business impact (not just HR jargon)
- Building the narrative around data for executive presentations

How you respond:
- Be direct, practical, and grounded in real HR experience
- When giving advice, be specific — give frameworks, example phrasings, or step-by-step guidance
- Use bold text for key terms or action items
- If the user wants to present something to stakeholders, help them craft the narrative and anticipate questions
- If they ask about a metric, explain what it means, what a healthy benchmark looks like, and what typically drives it
- Keep responses focused and readable — use bullet points where helpful
- If their question could also be answered with live data from their org, mention you can pull that too

You have access to the user's live HR database (employees, candidates, attendance, KPIs) and can answer data questions as well."""

            messages = [{"role": "system", "content": system}]
            for turn in history[-8:]:
                messages.append({"role": turn["role"], "content": turn["content"]})
            messages.append({"role": "user", "content": question})

            response = client.chat.completions.create(
                model=LLM_MODEL,
                messages=messages,
                temperature=0.5,
                max_tokens=700,
            )
            return response.choices[0].message.content.strip()

        except Exception:
            return (
                "I'm your HR analytics assistant. I can help with workforce data queries, "
                "HR metrics interpretation, stakeholder presentations, retention strategies, "
                "and people analytics advice. What would you like to explore?"
            )

    def _advisory_addendum(
        self, question: str, results: Optional[List[Dict]], history: List[Dict]
    ) -> str:
        """Generate a brief advisory insight to attach after a data answer."""
        if not results:
            return ""
        try:
            client = _llm_client()
            sample = json.dumps(results[:15], default=str)
            response = client.chat.completions.create(
                model=LLM_MODEL,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are an HR Business Partner. Given HR data results, "
                            "provide 2-3 brief, actionable insights or recommendations "
                            "an HR leader should consider. Be specific and practical. "
                            "Format as a short bulleted list under a bold heading like "
                            "**What this means for your team:**"
                        ),
                    },
                    {
                        "role": "user",
                        "content": f"Question: {question}\n\nData: {sample}",
                    },
                ],
                temperature=0.4,
                max_tokens=300,
            )
            return response.choices[0].message.content.strip()
        except Exception:
            return ""

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _get_or_create_conversation(
        self, org_id: UUID, user_id: UUID, question: str, conversation_id: Optional[UUID]
    ) -> AIConversation:
        if conversation_id:
            convo = self.db.query(AIConversation).filter(
                AIConversation.id == conversation_id,
                AIConversation.organization_id == org_id,
            ).first()
            if convo:
                return convo

        convo = AIConversation(
            id=uuid4(),
            organization_id=org_id,
            user_id=user_id,
            title=question[:100],
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        self.db.add(convo)
        self.db.flush()
        return convo

    def _load_history(self, conversation_id: UUID, org_id: UUID) -> List[Dict]:
        """Load recent messages from this conversation for context."""
        messages = (
            self.db.query(AIMessage)
            .filter(AIMessage.conversation_id == conversation_id)
            .order_by(AIMessage.created_at.desc())
            .limit(HISTORY_WINDOW)
            .all()
        )
        return [{"role": m.role, "content": m.content} for m in reversed(messages)]

    def _route_intent(self, question: str, history: List[Dict]) -> str:
        """Use the LLM to classify intent as 'data', 'chat', or 'both'.

        - data: needs a database query (headcount, trends, specific numbers)
        - chat: advice, tips, explanations, how-to, stakeholder comms, strategy
        - both: data question that also benefits from interpretation/advice
        """
        try:
            client = _llm_client()
            system = """Classify the user's question into one of three categories:

data  — requires querying a database (specific numbers, counts, trends, comparisons)
chat  — advice, tips, best practices, how to present/explain something, strategic guidance, greetings
both  — needs data AND interpretation/advice (e.g. "what's our attrition and what should we do about it?")

Reply with ONLY one word: data, chat, or both."""

            messages = [{"role": "system", "content": system}]
            for turn in history[-4:]:
                messages.append({"role": turn["role"], "content": turn["content"]})
            messages.append({"role": "user", "content": question})

            response = client.chat.completions.create(
                model=LLM_MODEL,
                messages=messages,
                temperature=0,
                max_tokens=5,
            )
            intent = response.choices[0].message.content.strip().lower()
            if intent not in ("data", "chat", "both"):
                intent = "data"
            return intent
        except Exception:
            # Fallback: simple heuristic if LLM call fails
            q = question.lower()
            advisory = any(p in q for p in [
                "tip", "advice", "how to", "how should", "best practice",
                "recommend", "suggest", "present", "stakeholder", "board",
                "report", "strategy", "explain", "what is a good", "help me",
                "hello", "hi ", "hey ", "thanks", "what can you",
            ])
            return "chat" if advisory else "data"

    def _validate_sql(self, sql: str) -> bool:
        sql_upper = sql.upper().strip()
        if not (sql_upper.startswith("SELECT") or sql_upper.startswith("WITH")):
            return False
        dangerous = ["INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "CREATE", "TRUNCATE", "GRANT", "REVOKE"]
        return not any(f" {kw} " in f" {sql_upper} " or sql_upper.startswith(kw) for kw in dangerous)

    def _execute_sql(self, sql: str, org_id: UUID) -> Tuple[Optional[List[Dict]], Optional[str]]:
        # Use a savepoint so a failed query doesn't roll back the outer transaction
        # (which holds the conversation and user message records)
        sp = self.db.begin_nested()
        try:
            self.db.execute(text("SET LOCAL statement_timeout = '10s'"))
            result = self.db.execute(text(sql))
            columns = list(result.keys())
            rows = []
            for row in result.fetchall():
                row_dict = {}
                for i, col in enumerate(columns):
                    val = row[i]
                    if hasattr(val, 'isoformat'):
                        val = val.isoformat()
                    elif hasattr(val, '__class__') and val.__class__.__name__ == 'Decimal':
                        val = float(val)
                    elif isinstance(val, float) and (val != val or val == float('inf')):  # NaN/inf guard
                        val = None
                    row_dict[col] = val
                rows.append(row_dict)
            return rows, None
        except Exception as e:
            sp.rollback()  # roll back to savepoint only — outer transaction stays intact
            return None, str(e)

    def _extract_sql(self, raw: str) -> Optional[str]:
        """Extract clean SQL from LLM output that may contain markdown or commentary."""
        if "```sql" in raw:
            return raw.split("```sql")[1].split("```")[0].strip()
        if "```" in raw:
            return raw.split("```")[1].split("```")[0].strip()
        if "SELECT" in raw.upper():
            idx = raw.upper().find("SELECT")
            sql = raw[idx:].strip()
            # Drop trailing commentary after a blank line
            if "\n\n" in sql:
                sql = sql.split("\n\n")[0]
            return sql
        return None

    def _infer_chart(self, results: List[Dict]) -> Optional[Dict]:
        """Choose a chart type based on result shape."""
        if not results or len(results) < 2:
            return None

        columns = list(results[0].keys())
        str_cols = [c for c in columns if isinstance(results[0].get(c), str) and c not in ('id', 'organization_id')]
        num_cols = [c for c in columns if isinstance(results[0].get(c), (int, float))]
        date_cols = [c for c in columns if isinstance(results[0].get(c), str) and
                     results[0].get(c, '') and len(results[0].get(c, '')) >= 10 and
                     results[0].get(c, '')[:4].isdigit()]

        if not num_cols:
            return None

        # Time-series: has a date-like column → line chart
        if date_cols and num_cols:
            return {
                "type": "line",
                "xKey": date_cols[0],
                "yKeys": [num_cols[0]],
                "title": f"{num_cols[0].replace('_', ' ').title()} over Time",
            }

        # Small categorical (2–6 items, single metric) → pie
        if str_cols and len(results) <= 6 and len(num_cols) == 1:
            return {
                "type": "pie",
                "nameKey": str_cols[0],
                "valueKey": num_cols[0],
                "title": f"Distribution by {str_cols[0].replace('_', ' ').title()}",
            }

        # Otherwise → bar
        if str_cols and num_cols and len(results) <= 20:
            return {
                "type": "bar",
                "xKey": str_cols[0],
                "yKeys": [num_cols[0]],
                "title": f"{num_cols[0].replace('_', ' ').title()} by {str_cols[0].replace('_', ' ').title()}",
            }

        return None

    def _template_summary(self, question: str, results: List[Dict]) -> str:
        """Minimal fallback summary when LLM answer generation fails."""
        if not results:
            return "No data found."
        columns = list(results[0].keys())
        num_cols = [c for c in columns if isinstance(results[0].get(c), (int, float))]
        str_cols = [c for c in columns if isinstance(results[0].get(c), str)]
        lines = [f"Found **{len(results)}** records."]
        if str_cols and num_cols:
            label, metric = str_cols[0], num_cols[0]
            top = sorted(results, key=lambda r: r.get(metric, 0) or 0, reverse=True)[:3]
            parts = [f"{r[label]} ({round(r[metric], 1) if isinstance(r[metric], float) else r[metric]})" for r in top]
            lines.append(f"Top by {metric.replace('_', ' ')}: {', '.join(parts)}.")
        return " ".join(lines)

    def _fallback_sql(self, question: str, org_id: UUID) -> Tuple[Optional[str], Optional[str]]:
        """Pattern-based SQL generation when LLM is unavailable."""
        q = question.lower()
        org = str(org_id)
        if "headcount" in q or "how many employees" in q:
            return (
                f"SELECT department, COUNT(*) as headcount FROM employees "
                f"WHERE organization_id = '{org}' AND status = 'active' "
                f"GROUP BY department ORDER BY headcount DESC",
                None,
            )
        if "attrition" in q or "turnover" in q:
            return (
                f"SELECT department, "
                f"ROUND((COUNT(CASE WHEN status = 'terminated' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0))::numeric, 1) as turnover_rate "
                f"FROM employees WHERE organization_id = '{org}' "
                f"GROUP BY department ORDER BY turnover_rate DESC",
                None,
            )
        return None, "I couldn't generate a query for that. Please try rephrasing."
