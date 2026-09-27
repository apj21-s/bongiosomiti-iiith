import RadioAlignerClient from './RadioAlignerClient'

export const metadata = {
  title: 'Dev: Radio Aligner',
}

export default function RadioAlignerPage() {
  if (process.env.NODE_ENV !== 'development') {
    return (
      <div className="p-8 text-center text-red-500">
        <h1>403 Forbidden</h1>
        <p>This development tool is not accessible in production.</p>
      </div>
    )
  }

  return <RadioAlignerClient />
}
