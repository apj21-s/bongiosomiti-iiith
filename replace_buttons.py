import re

with open('app/events/[slug]/RegistrationForm.tsx', 'r') as f:
    content = f.read()

# Add RegButton definition before function PaymentStep
reg_button_code = """
function RegButton({ text, onClick, type = 'continue', disabled = false, style, loadingText }: any) {
  const isBack = type === 'back';
  const baseClass = type === 'home' ? 'reg-btn-home' : `reg-btn-${type}`;
  const className = `${baseClass} hover-btn ${isBack ? 'left' : 'right'}`;
  const displayText = disabled && loadingText ? loadingText : text;
  
  return (
    <button className={className} onClick={onClick} disabled={disabled} style={style}>
      <div className="hover-btn-dot"></div>
      <span className="hover-btn-text-idle">{displayText}</span>
      <div className="hover-btn-text-hover">
        {isBack ? <>&larr; <span>{displayText}</span></> : <><span>{displayText}</span> &rarr;</>}
      </div>
    </button>
  )
}

"""

content = content.replace("function ReelColumn", reg_button_code + "function ReelColumn")

# Replace buttons manually based on grep results

content = content.replace(
    """<button className="reg-btn-continue" onClick={nextStage}>CONTINUE &rarr;</button>""",
    """<RegButton text="CONTINUE" onClick={nextStage} type="continue" />"""
)
content = content.replace(
    """<button className="reg-btn-back" onClick={prevStage}>&larr; Back</button>""",
    """<RegButton text="BACK" onClick={prevStage} type="back" />"""
)
content = content.replace(
    """<button className="reg-btn-back" onClick={prevStage}>&larr; BACK</button>""",
    """<RegButton text="BACK" onClick={prevStage} type="back" />"""
)
content = content.replace(
    """<button className="reg-btn-continue" style={{width: 'auto', padding: '0 16px'}} onClick={() => transitionTo({ paymentState: 'COMPLETED' })}>I HAVE MADE THE PAYMENT &rarr;</button>""",
    """<RegButton text="I HAVE MADE THE PAYMENT" onClick={() => transitionTo({ paymentState: 'COMPLETED' })} type="continue" style={{width: 'auto', padding: '0 16px'}} />"""
)
content = content.replace(
    """<button className="reg-btn-back" onClick={() => transitionTo({ paymentState: 'READY' })}>&larr; Back</button>""",
    """<RegButton text="BACK" onClick={() => transitionTo({ paymentState: 'READY' })} type="back" />"""
)
content = content.replace(
    """<button className="reg-btn-continue" onClick={handleSubmit} disabled={loading}>{loading ? 'PROCESSING...' : 'SUBMIT &rarr;'}</button>""",
    """<RegButton text="SUBMIT" onClick={handleSubmit} disabled={loading} loadingText="PROCESSING..." type="continue" />"""
)
content = content.replace(
    """<button className="reg-btn-home" onClick={() => window.location.href = '/'}>GO TO HOME &rarr;</button>""",
    """<RegButton text="GO TO HOME" onClick={() => window.location.href = '/'} type="home" />"""
)

with open('app/events/[slug]/RegistrationForm.tsx', 'w') as f:
    f.write(content)

print("Done replacing buttons")
