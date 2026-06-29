import { NextRequest, NextResponse } from 'next/server'

// RevenueCat API endpoint for getting customer statistics
const REVENUCAT_API_URL = 'https://api.revenuecat.com/v1'
const REVENUCAT_SECRET_KEY = process.env.REVENUCAT_SECRET_API_KEY

export async function GET(request: NextRequest) {
  if (!REVENUCAT_SECRET_KEY) {
    return NextResponse.json(
      { error: 'RevenueCat API key not configured' },
      { status: 500 }
    )
  }

  try {
    // Get customers endpoint
    const response = await fetch(`${REVENUCAT_API_URL}/customers?limit=1`, {
      headers: {
        'Authorization': `Bearer ${REVENUCAT_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`RevenueCat API error: ${response.statusText}`)
    }

    const data = await response.json()

    // Parse response to extract stats
    const customers = data.customers || []
    const totalCustomers = data.total_customers || 0

    // Count premium customers (those with active subscriptions)
    let premiumCount = 0
    let totalMRR = 0

    for (const customer of customers) {
      if (customer.subscriptions && Object.keys(customer.subscriptions).length > 0) {
        premiumCount++
        // Calculate MRR from subscriptions
        Object.values(customer.subscriptions).forEach((sub: any) => {
          if (sub.is_sandbox === false && sub.auto_resume_date === null) {
            // Active subscription
            const monthlyPrice = sub.original_purchase_date
              ? calculateMRR(sub)
              : 0
            totalMRR += monthlyPrice
          }
        })
      }
    }

    return NextResponse.json({
      success: true,
      stats: {
        totalCustomers,
        premiumCustomers: premiumCount,
        freeCustomers: totalCustomers - premiumCount,
        monthlyRecurringRevenue: Number(totalMRR.toFixed(2)),
        churnRate: totalCustomers > 0 ? 0 : 0, // Placeholder - would need more data
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('RevenueCat API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch RevenueCat stats' },
      { status: 500 }
    )
  }
}

function calculateMRR(subscription: any): number {
  // Simple MRR calculation from subscription data
  // In reality, this would be more complex based on plan pricing
  // Default: assume 4.99€ (monthly) or 49.99€ (yearly as ~4.17€/month)
  if (subscription.product_identifier?.includes('yearly')) {
    return 49.99 / 12
  }
  return 4.99
}
