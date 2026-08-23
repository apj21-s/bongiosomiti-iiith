'use client'

export default function PrintButton() {
  return (
    <button 
      type="button" 
      className="btn btn-secondary pass-world__print" 
      title="Print or Save as PDF"
      onClick={() => window.print()}
    >
      🖨 Print Pass
    </button>
  )
}
