"""
Scenario Planning Model

Provides financial modeling for workforce scenarios:
- Growth scenarios
- Decline/restructuring scenarios
- M&A integration scenarios
- Custom what-if analysis

Includes Monte Carlo simulation for risk analysis.
"""

import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional
from dataclasses import dataclass
from enum import Enum


class ScenarioType(Enum):
    GROWTH = 'growth'
    DECLINE = 'decline'
    STABLE = 'stable'
    CUSTOM = 'custom'


@dataclass
class ScenarioParameters:
    """Parameters defining a workforce scenario"""
    name: str
    type: ScenarioType
    headcount_growth_rate: float  # Annual %
    attrition_rate: float  # Annual %
    hiring_pace: float  # % of normal pace
    revenue_growth_rate: float  # Annual %
    productivity_change: float  # Annual %
    avg_salary_change: float  # Annual %
    duration_months: int


@dataclass
class FinancialMetrics:
    """Company financial metrics for scenario modeling"""
    annual_revenue: float
    annual_profit: float
    current_headcount: int
    avg_salary: float
    benefits_cost_ratio: float  # % of salary
    overhead_per_employee: float
    revenue_per_employee: float
    profit_per_employee: float


DEFAULT_SCENARIOS = {
    'aggressive_growth': ScenarioParameters(
        name='Aggressive Growth',
        type=ScenarioType.GROWTH,
        headcount_growth_rate=25,
        attrition_rate=10,
        hiring_pace=150,
        revenue_growth_rate=30,
        productivity_change=5,
        avg_salary_change=5,
        duration_months=24
    ),
    'moderate_growth': ScenarioParameters(
        name='Moderate Growth',
        type=ScenarioType.GROWTH,
        headcount_growth_rate=12,
        attrition_rate=11,
        hiring_pace=120,
        revenue_growth_rate=15,
        productivity_change=2,
        avg_salary_change=3,
        duration_months=24
    ),
    'stable': ScenarioParameters(
        name='Stable / Maintenance',
        type=ScenarioType.STABLE,
        headcount_growth_rate=3,
        attrition_rate=12,
        hiring_pace=100,
        revenue_growth_rate=5,
        productivity_change=1,
        avg_salary_change=3,
        duration_months=24
    ),
    'economic_downturn': ScenarioParameters(
        name='Economic Downturn',
        type=ScenarioType.DECLINE,
        headcount_growth_rate=-10,
        attrition_rate=8,
        hiring_pace=30,
        revenue_growth_rate=-5,
        productivity_change=-3,
        avg_salary_change=0,
        duration_months=24
    ),
    'restructuring': ScenarioParameters(
        name='Restructuring',
        type=ScenarioType.DECLINE,
        headcount_growth_rate=-15,
        attrition_rate=5,
        hiring_pace=10,
        revenue_growth_rate=-8,
        productivity_change=5,  # Efficiency gains
        avg_salary_change=0,
        duration_months=18
    ),
}


class ScenarioModel:
    """
    Financial modeling for workforce scenarios.

    Calculates:
    - Projected headcount over time
    - Revenue and profit impact
    - Labor costs
    - Hiring costs
    - ROI analysis
    """

    def __init__(self, financial_metrics: FinancialMetrics):
        self.metrics = financial_metrics
        self.cost_per_hire = 4500  # Default
        self.training_cost_per_hire = 2500
        self.severance_weeks = 4

    def run_scenario(
        self,
        scenario: ScenarioParameters,
        monthly: bool = True
    ) -> Dict[str, Any]:
        """
        Run a scenario simulation.

        Args:
            scenario: Scenario parameters
            monthly: Return monthly projections if True

        Returns:
            Complete scenario analysis with projections
        """
        periods = scenario.duration_months if monthly else scenario.duration_months // 12

        projections = self._generate_projections(scenario, monthly)
        financials = self._calculate_financials(scenario, projections)
        risks = self._assess_risks(scenario, projections)
        recommendations = self._generate_recommendations(scenario, financials, risks)

        return {
            'scenario': {
                'name': scenario.name,
                'type': scenario.type.value,
                'duration_months': scenario.duration_months
            },
            'projections': projections,
            'financials': financials,
            'risks': risks,
            'recommendations': recommendations,
            'summary': self._generate_summary(scenario, financials)
        }

    def compare_scenarios(
        self,
        scenarios: List[ScenarioParameters]
    ) -> Dict[str, Any]:
        """Compare multiple scenarios side by side"""
        results = []

        for scenario in scenarios:
            result = self.run_scenario(scenario, monthly=False)
            results.append({
                'name': scenario.name,
                'type': scenario.type.value,
                'final_headcount': result['projections'][-1]['headcount'],
                'headcount_change': result['projections'][-1]['headcount'] - self.metrics.current_headcount,
                'total_revenue': result['financials']['total_revenue'],
                'total_profit': result['financials']['total_profit'],
                'total_labor_cost': result['financials']['total_labor_cost'],
                'total_hiring_cost': result['financials']['total_hiring_cost'],
                'roi': result['financials']['roi'],
                'risk_score': result['risks']['overall_score']
            })

        # Rank scenarios
        ranked = sorted(results, key=lambda x: x['roi'], reverse=True)
        for i, r in enumerate(ranked):
            r['rank'] = i + 1

        return {
            'scenarios': results,
            'recommendation': ranked[0]['name'] if ranked else None,
            'comparison_date': pd.Timestamp.now().isoformat()
        }

    def monte_carlo_simulation(
        self,
        scenario: ScenarioParameters,
        simulations: int = 1000
    ) -> Dict[str, Any]:
        """
        Run Monte Carlo simulation for risk analysis.

        Varies key parameters within reasonable ranges to
        estimate probability distributions of outcomes.
        """
        results = []

        for _ in range(simulations):
            # Add random variation to parameters
            varied_scenario = ScenarioParameters(
                name=scenario.name,
                type=scenario.type,
                headcount_growth_rate=scenario.headcount_growth_rate + np.random.normal(0, 3),
                attrition_rate=max(0, scenario.attrition_rate + np.random.normal(0, 2)),
                hiring_pace=max(0, scenario.hiring_pace + np.random.normal(0, 10)),
                revenue_growth_rate=scenario.revenue_growth_rate + np.random.normal(0, 5),
                productivity_change=scenario.productivity_change + np.random.normal(0, 2),
                avg_salary_change=scenario.avg_salary_change + np.random.normal(0, 1),
                duration_months=scenario.duration_months
            )

            result = self.run_scenario(varied_scenario, monthly=False)
            results.append({
                'final_headcount': result['projections'][-1]['headcount'],
                'total_profit': result['financials']['total_profit'],
                'roi': result['financials']['roi']
            })

        # Calculate statistics
        profits = [r['total_profit'] for r in results]
        headcounts = [r['final_headcount'] for r in results]
        rois = [r['roi'] for r in results]

        return {
            'simulations': simulations,
            'profit': {
                'mean': np.mean(profits),
                'std': np.std(profits),
                'p10': np.percentile(profits, 10),
                'p50': np.percentile(profits, 50),
                'p90': np.percentile(profits, 90),
                'probability_positive': sum(1 for p in profits if p > 0) / len(profits)
            },
            'headcount': {
                'mean': np.mean(headcounts),
                'std': np.std(headcounts),
                'p10': np.percentile(headcounts, 10),
                'p50': np.percentile(headcounts, 50),
                'p90': np.percentile(headcounts, 90)
            },
            'roi': {
                'mean': np.mean(rois),
                'std': np.std(rois),
                'p10': np.percentile(rois, 10),
                'p50': np.percentile(rois, 50),
                'p90': np.percentile(rois, 90)
            }
        }

    def _generate_projections(
        self,
        scenario: ScenarioParameters,
        monthly: bool
    ) -> List[Dict[str, Any]]:
        """Generate period-by-period projections"""
        projections = []
        headcount = self.metrics.current_headcount
        revenue = self.metrics.annual_revenue
        avg_salary = self.metrics.avg_salary

        periods = scenario.duration_months if monthly else scenario.duration_months // 12
        period_factor = 1/12 if monthly else 1

        for period in range(periods + 1):
            if period > 0:
                # Calculate changes
                growth_rate = scenario.headcount_growth_rate / 100 * period_factor
                attrition_rate = scenario.attrition_rate / 100 * period_factor
                revenue_growth = scenario.revenue_growth_rate / 100 * period_factor
                salary_growth = scenario.avg_salary_change / 100 * period_factor

                # Update values
                attrition = int(headcount * attrition_rate)
                target_headcount = headcount * (1 + growth_rate)
                hires_needed = max(0, int(target_headcount - headcount + attrition))
                actual_hires = int(hires_needed * scenario.hiring_pace / 100)

                headcount = headcount - attrition + actual_hires
                revenue = revenue * (1 + revenue_growth)
                avg_salary = avg_salary * (1 + salary_growth)

            projections.append({
                'period': period,
                'headcount': int(headcount),
                'revenue': revenue,
                'avg_salary': avg_salary,
                'revenue_per_employee': revenue / headcount if headcount > 0 else 0,
                'attrition': attrition if period > 0 else 0,
                'hires': actual_hires if period > 0 else 0
            })

        return projections

    def _calculate_financials(
        self,
        scenario: ScenarioParameters,
        projections: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Calculate financial impact of scenario"""
        initial = projections[0]
        final = projections[-1]

        # Calculate totals
        total_hires = sum(p['hires'] for p in projections)
        total_attrition = sum(p['attrition'] for p in projections)

        # Costs
        total_hiring_cost = total_hires * (self.cost_per_hire + self.training_cost_per_hire)

        # Severance for layoffs (if declining scenario)
        layoffs = max(0, initial['headcount'] - final['headcount'] - total_attrition)
        severance_cost = layoffs * (self.metrics.avg_salary / 52 * self.severance_weeks)

        # Labor costs
        avg_headcount = np.mean([p['headcount'] for p in projections])
        annual_labor_cost = avg_headcount * self.metrics.avg_salary * (1 + self.metrics.benefits_cost_ratio)
        total_labor_cost = annual_labor_cost * (scenario.duration_months / 12)

        # Revenue and profit
        total_revenue = sum(p['revenue'] for p in projections[1:]) / 12  # Monthly to annual
        productivity_impact = self.metrics.annual_revenue * (scenario.productivity_change / 100) * (scenario.duration_months / 12)

        # Profit calculation
        profit_margin = self.metrics.annual_profit / self.metrics.annual_revenue
        base_profit = total_revenue * profit_margin
        total_profit = base_profit + productivity_impact - total_hiring_cost - severance_cost

        # ROI
        total_investment = total_hiring_cost + severance_cost
        roi = ((total_profit - self.metrics.annual_profit * (scenario.duration_months / 12)) / total_investment * 100) if total_investment > 0 else 0

        return {
            'total_revenue': round(total_revenue, 0),
            'total_profit': round(total_profit, 0),
            'total_labor_cost': round(total_labor_cost, 0),
            'total_hiring_cost': round(total_hiring_cost, 0),
            'severance_cost': round(severance_cost, 0),
            'productivity_impact': round(productivity_impact, 0),
            'total_hires': total_hires,
            'total_attrition': total_attrition,
            'net_headcount_change': final['headcount'] - initial['headcount'],
            'roi': round(roi, 2),
            'profit_per_employee_final': round(total_profit / final['headcount'], 0) if final['headcount'] > 0 else 0
        }

    def _assess_risks(
        self,
        scenario: ScenarioParameters,
        projections: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Assess risks associated with scenario"""
        risks = []
        score = 0

        # Hiring velocity risk
        if scenario.hiring_pace > 130:
            risks.append({
                'type': 'hiring_velocity',
                'severity': 'high',
                'description': 'High hiring pace may strain recruiting capacity and reduce quality of hire'
            })
            score += 25

        # Attrition risk during growth
        if scenario.type == ScenarioType.GROWTH and scenario.attrition_rate > 15:
            risks.append({
                'type': 'attrition',
                'severity': 'medium',
                'description': 'High growth with high attrition creates cultural instability'
            })
            score += 15

        # Revenue dependency risk
        if abs(scenario.revenue_growth_rate - scenario.headcount_growth_rate) > 10:
            risks.append({
                'type': 'productivity',
                'severity': 'medium',
                'description': 'Headcount growth not aligned with revenue growth'
            })
            score += 15

        # Layoff risk
        if scenario.headcount_growth_rate < -5:
            risks.append({
                'type': 'morale',
                'severity': 'high',
                'description': 'Significant headcount reduction may impact remaining employee morale'
            })
            score += 20

        # Cash flow risk
        total_hires = sum(p['hires'] for p in projections)
        if total_hires > self.metrics.current_headcount * 0.5:
            risks.append({
                'type': 'cash_flow',
                'severity': 'medium',
                'description': 'Significant hiring costs may strain cash flow'
            })
            score += 15

        return {
            'risks': risks,
            'overall_score': min(100, score),
            'risk_level': 'high' if score >= 50 else 'medium' if score >= 25 else 'low'
        }

    def _generate_recommendations(
        self,
        scenario: ScenarioParameters,
        financials: Dict[str, Any],
        risks: Dict[str, Any]
    ) -> List[str]:
        """Generate actionable recommendations"""
        recommendations = []

        if scenario.hiring_pace > 130:
            recommendations.append('Consider adding contract recruiters to handle increased hiring volume')

        if financials['total_hiring_cost'] > self.metrics.annual_profit * 0.2:
            recommendations.append('Hiring costs exceed 20% of annual profit - consider phased hiring approach')

        if scenario.attrition_rate > 15:
            recommendations.append('Implement retention initiatives before scaling to reduce replacement costs')

        if scenario.type == ScenarioType.DECLINE:
            recommendations.append('Develop clear communication plan for workforce changes')
            recommendations.append('Identify critical roles to retain during transition')

        if scenario.productivity_change < 0:
            recommendations.append('Invest in tools and training to maintain productivity during transition')

        if financials['roi'] < 10:
            recommendations.append('Consider alternative scenarios with higher expected ROI')

        return recommendations

    def _generate_summary(
        self,
        scenario: ScenarioParameters,
        financials: Dict[str, Any]
    ) -> str:
        """Generate executive summary"""
        change = financials['net_headcount_change']
        direction = 'increase' if change > 0 else 'decrease' if change < 0 else 'maintain'

        return (
            f"The {scenario.name} scenario projects a {direction} in headcount "
            f"of {abs(change)} employees over {scenario.duration_months} months, "
            f"with an expected ROI of {financials['roi']}%. "
            f"Total investment required: ${financials['total_hiring_cost'] + financials['severance_cost']:,.0f}."
        )
