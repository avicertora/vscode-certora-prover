/// <reference types="svelte" />

interface VSCodeWebApi {
  getState: <S>() => S
  postMessage: (message: Record<string, string>) => void
  setState: <S>(state: S) => void
}

// eslint-disable-next-line no-unused-vars
declare const vscode: VSCodeWebApi
