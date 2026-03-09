// Generate synthetic historical headcount based on current count
export function generateHistoricalHeadcount(months: number, currentCount: number) {
  const data = []
  for (let i = months; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    // Simulate slight growth trend backwards
    const factor = 1 - (i * 0.005) + (Math.random() * 0.01 - 0.005)
    data.push({ date: label, headcount: Math.round(currentCount * factor) })
  }
  return data
}
