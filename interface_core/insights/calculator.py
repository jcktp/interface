from collections import Counter
from datetime import date
from decimal import Decimal, ROUND_HALF_UP


class WorkforceCalculator:
    @staticmethod
    def money(minor):
        return str((Decimal(minor) / 100).quantize(Decimal('.01'), rounding=ROUND_HALF_UP))

    def summarize(self, people, as_of: date):
        active = [p for p in people if p['status'] == 'active']
        tenures = [(as_of - date.fromisoformat(p['hire_date'])).days for p in active if p['hire_date'] and date.fromisoformat(p['hire_date']) <= as_of and (not p['end_date'] or date.fromisoformat(p['end_date']) >= as_of)]
        companies = Counter(p['previous_company'] for p in active if p['previous_company'])
        return {'as_of': as_of.isoformat(), 'active_headcount': len(active),
                'tenure_sample_size': len(tenures), 'missing_tenure_count': len(active) - len(tenures),
                'average_tenure_years': round(sum(tenures) / len(tenures) / 365.2425, 2) if tenures else None,
                'total_tenure_years': round(sum(tenures) / 365.2425, 2) if tenures else None,
                'previous_companies': [{'company': name, 'people': count} for name, count in sorted(companies.items(), key=lambda pair: (-pair[1], pair[0]))],
                'departments': dict(Counter(p['department'] or 'Unassigned' for p in active))}

    def finance(self, period, people):
        start, end = date.fromisoformat(period['start_date']), date.fromisoformat(period['end_date'])
        missing = sum(not p['hire_date'] or (p['status'] == 'inactive' and not p['end_date']) for p in people)
        person_days = 0
        for person in people:
            if not person['hire_date']:
                continue
            first = max(start, date.fromisoformat(person['hire_date']))
            last = min(end, date.fromisoformat(person['end_date']) if person['end_date'] else end)
            person_days += max(0, (last - first).days + 1)
        average = Decimal(person_days) / Decimal((end - start).days + 1)
        valid = not missing and average > 0
        return {**period, 'revenue': self.money(period['revenue_minor']), 'profit': self.money(period['profit_minor']),
                'average_headcount': float(round(average, 4)) if not missing else None,
                'revenue_per_employee': self.money(Decimal(period['revenue_minor']) / average) if valid else None,
                'profit_per_employee': self.money(Decimal(period['profit_minor']) / average) if valid else None,
                'missing_employment_records': missing,
                'denominator': 'Average daily headcount over the inclusive period; not FTE'}

    def plan(self, record, active_headcount):
        total_minor = Decimal(record['target_headcount']) * record['annual_cost_minor'] * record['months'] / 12
        return {**record, 'annual_cost_per_employee': self.money(record['annual_cost_minor']),
                'current_headcount': active_headcount, 'headcount_change': record['target_headcount'] - active_headcount,
                'projected_workforce_cost': self.money(total_minor),
                'assumption': 'Target headcount is constant throughout the period; annual cost includes all employer costs supplied by you.'}
