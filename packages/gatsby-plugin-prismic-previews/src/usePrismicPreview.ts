import * as React from 'react'
import * as RTE from 'fp-ts/ReaderTaskEither'
import { pipe, flow, constVoid } from 'fp-ts/function'
import Prismic from 'prismic-javascript'
import {
  Dependencies,
  registerCustomTypes,
  createBaseTypes,
  registerAllDocumentTypesType,
  sourceNodesForAllDocuments,
  getCookieSafely,
} from 'gatsby-prismic-core'

import {
  PrismicContextAction,
  PrismicContextActionType,
  usePrismicContext,
} from './usePrismicContext'
import { buildDependencies } from './buildDependencies'

enum ActionType {
  IsLoaded = 'IsLoaded',
}

type Action = {
  type: ActionType.IsLoaded
}

interface State {
  isLoading: boolean
}

const initialState = {
  isLoading: false,
}

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case ActionType.IsLoaded: {
      return {
        ...state,
        isLoading: false,
      }
    }
  }
}

interface PrismicPreviewProgramDependencies {
  isBootstrapped: boolean
  dispatch: (action: Action) => void
  contextDispatch: (action: PrismicContextAction) => void
}

const declareLoaded = (): RTE.ReaderTaskEither<
  PrismicPreviewProgramDependencies & Dependencies,
  never,
  void
> =>
  RTE.asks((deps) =>
    deps.dispatch({
      type: ActionType.IsLoaded,
    }),
  )

const declareBootstrapped = (): RTE.ReaderTaskEither<
  PrismicPreviewProgramDependencies & Dependencies,
  never,
  void
> =>
  RTE.asks((deps) =>
    deps.contextDispatch({
      type: PrismicContextActionType.IsBootstrapped,
      payload: { repositoryName: deps.pluginOptions.repositoryName },
    }),
  )

const prismicPreviewProgram: RTE.ReaderTaskEither<
  PrismicPreviewProgramDependencies & Dependencies,
  void,
  void
> = pipe(
  RTE.ask<PrismicPreviewProgramDependencies & Dependencies>(),
  RTE.chainFirstW(
    RTE.fromPredicate(
      () => Boolean(getCookieSafely(Prismic.previewCookie)),
      constVoid,
    ),
  ),
  RTE.chainFirstW(RTE.fromPredicate((deps) => !deps.isBootstrapped, constVoid)),
  RTE.chainFirstW(createBaseTypes),
  RTE.chainFirstW(
    flow(registerCustomTypes, RTE.chain(registerAllDocumentTypesType)),
  ),
  RTE.chainFirstW(() => sourceNodesForAllDocuments()),
  RTE.chainFirstW(declareBootstrapped),
  RTE.chainFirstW(declareLoaded),
  RTE.map(constVoid),
)

export type UsePrismicPreviewConfig = {
  repositoryName: string
}

export const usePrismicPreview = (config: UsePrismicPreviewConfig): State => {
  const [state, dispatch] = React.useReducer(reducer, initialState)
  const [contextState, contextDispatch] = usePrismicContext()

  React.useEffect(() => {
    const pluginOptions = contextState.pluginOptionsMap[config.repositoryName]
    if (!pluginOptions)
      throw Error(
        `usePrismicPreview was configured to use a repository with the name "${config.repositoryName}" but was not registered in the top-level PrismicProvider component. Please check your repository name and/or PrismicProvider props.`,
      )

    const dependencies = {
      ...buildDependencies(contextState, contextDispatch, pluginOptions),
      isBootstrapped:
        contextState.isBootstrappedMap[pluginOptions.repositoryName],
      dispatch,
      contextDispatch,
    }

    RTE.run(prismicPreviewProgram, dependencies)
  }, [contextState, contextDispatch, config.repositoryName])

  return state
}
