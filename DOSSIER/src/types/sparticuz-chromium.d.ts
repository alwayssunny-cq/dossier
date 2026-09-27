declare module '@sparticuz/chromium' {
  const chromium: {
    args: string[]
    executablePath: string | (() => Promise<string>)
  }
  export default chromium
}
