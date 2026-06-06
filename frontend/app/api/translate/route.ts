import { NextRequest, NextResponse } from 'next/server'

const SYSTEM_PROMPT = `You are an expert AML (Anti-Money Laundering) compliance engineer with deep experience translating regulatory risk assessments into practical transaction monitoring rule configurations.

You will be given an AML Business Risk Assessment (BRA) or similar compliance document from a fintech or payment institution. Your job is to analyse it and produce a structured rule configuration recommendation.

Your output must be grounded strictly in the document provided. Do not invent risks or controls that are not mentioned or implied by the document. Where the document is silent on a topic, say so explicitly rather than filling in gaps with assumptions.

Return ONLY a valid JSON object — no markdown fences, no prose, no commentary outside the JSON. Use exactly this schema:

{
  "configuration_version": "1.0",
  "company": "company name from document",
  "overall_risk_rating": "low|medium|medium-high|high",
  "risk_profile_summary": "5-8 sentence plain English summary covering: primary business model and customer base, highest-risk products or transaction types, key geographic exposures, stated control strengths and known gaps, overall risk rating rationale",
  "rules": [
    {
      "rule_id": "R01",
      "rule_name": "Short descriptive name",
      "priority": "critical|high|medium|low",
      "status": "recommended|pending_data|requires_mlro_input",
      "rationale": "One sentence grounded in the document",
      "trigger_description": "Plain English: when this rule fires — amounts, geography, frequency, customer segment, product type",
      "suggested_threshold": "Specific value or range with brief reasoning",
      "calibration_too_tight": "False positive pattern this generates",
      "calibration_too_loose": "True positive this would miss",
      "depends_on": [],
      "data_fields_required": ["field_name"],
      "open_questions": []
    }
  ],
  "cross_rule_interactions": [
    {
      "rules": ["R01", "R02"],
      "interaction_type": "complementary|must_calibrate_together|sequencing_dependency",
      "description": "One sentence"
    }
  ],
  "data_gaps": [
    {
      "field": "field_name",
      "required_by_rules": ["R01"],
      "typically_available": "yes|sometimes|no",
      "risk_if_absent": "Brief description"
    }
  ],
  "open_questions": [
    {
      "question_id": "Q1",
      "question": "Full question text",
      "affects_rules": ["R01"],
      "why_it_matters": "One sentence"
    }
  ]
}

Produce 8-12 rules ordered by priority descending. Be concise in all string fields — one sentence maximum per field. Return ONLY valid JSON.`

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { document } = body

    if (!document || String(document).trim() === '') {
      return NextResponse.json({ error: 'No document provided' }, { status: 400 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 16000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: String(document) }],
      }),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error((err as { error?: { message?: string } }).error?.message ?? `Anthropic API error ${response.status}`)
    }

    const data = await response.json()
    const rawText: string = data?.content?.[0]?.text ?? ''

    if (!rawText) {
      throw new Error('Empty response from model')
    }

    // Extract the JSON object — find outermost { ... } regardless of surrounding prose or fences
    const start = rawText.indexOf('{')
    const end = rawText.lastIndexOf('}')

    if (start === -1 || end === -1 || end <= start) {
      console.error('[translate] No JSON object found. Raw text:', rawText.slice(0, 500))
      throw new Error('Model returned non-JSON output. Try again.')
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(rawText.slice(start, end + 1))
    } catch (parseErr) {
      console.error('[translate] JSON parse failed:', (parseErr as Error).message)
      console.error('[translate] Raw text slice:', rawText.slice(start, start + 500))
      throw new Error(`JSON parse error: ${(parseErr as Error).message}`)
    }

    return NextResponse.json(parsed)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
