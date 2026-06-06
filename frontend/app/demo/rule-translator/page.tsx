import RuleTranslator from '@/components/RuleTranslator'

export default function RuleTranslatorPage() {
  return (
    <div className="px-8 py-8">
      <div className="mb-6">
        <h1
          className="font-semibold mb-0.5"
          style={{ fontSize: '1.375rem', color: 'var(--text-primary)', letterSpacing: '-0.015em' }}
        >
          Rule Translator
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Paste an AML Business Risk Assessment to generate a prioritised rule configuration.
        </p>
      </div>
      <div className="bg-white rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
        <RuleTranslator />
      </div>
    </div>
  )
}
