declare module 'mammoth' {
  interface ExtractRawTextResult {
    value: string
    messages: any[]
  }

  interface ConvertToHtmlResult {
    value: string
    messages: any[]
  }

  interface Options {
    buffer?: Buffer
    path?: string
    convertImage?: any
    ignoreEmptyParagraphs?: boolean
    styleMap?: string[]
  }

  function extractRawText(options: Options): Promise<ExtractRawTextResult>
  function convertToHtml(options: Options): Promise<ConvertToHtmlResult>

  const mammoth: {
    extractRawText: typeof extractRawText
    convertToHtml: typeof convertToHtml
  }

  export = mammoth
} 