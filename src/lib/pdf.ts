import 'server-only'

export async function loadPdfParser() {
  // PDF.js loads canvas through a dynamic require that standalone tracing misses.
  // Keep this explicit import so native bindings ship with PDF consumers.
  await import('@napi-rs/canvas')
  return import('pdf-parse')
}

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const { PDFParse } = await loadPdfParser()
  const parser = new PDFParse({ data: buffer })

  try {
    const result = await parser.getText()
    return result.text
  } finally {
    await parser.destroy()
  }
}
