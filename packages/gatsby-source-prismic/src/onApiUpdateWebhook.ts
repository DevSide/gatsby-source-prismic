import * as RTE from 'fp-ts/ReaderTaskEither'
import * as A from 'fp-ts/Array'
import * as Eq from 'fp-ts/Eq'
import { pipe, constVoid } from 'fp-ts/function'
import {
  Dependencies,
  queryDocumentsByIds,
  createNodes,
} from 'gatsby-prismic-core'

import { PrismicWebhookBodyApiUpdate } from './types'
import { deleteNodesForDocumentIds } from './lib/deleteNodesForDocumentIds'

export const onApiUpdateWebhook = (
  webhookBody: PrismicWebhookBodyApiUpdate,
): RTE.ReaderTaskEither<Dependencies, never, void> =>
  pipe(
    RTE.right({}),
    RTE.bind('documentIds', () =>
      extractApiUpdateWebhookBodyDocumentIds(webhookBody),
    ),
    RTE.bind('documentsToUpdate', (scope) =>
      queryDocumentsByIds(scope.documentIds),
    ),
    RTE.bind('documentIdsToDelete', (scope) =>
      pipe(
        scope.documentsToUpdate,
        A.map((document) => document.id),
        A.difference(Eq.eqString)(webhookBody.documents),
        (ids) => RTE.of(ids),
      ),
    ),
    RTE.chainFirst((scope) =>
      deleteNodesForDocumentIds(scope.documentIdsToDelete),
    ),
    RTE.chainFirst((scope) => createNodes(scope.documentsToUpdate)),
    RTE.map(constVoid),
  )

const extractApiUpdateWebhookBodyDocumentIds = (
  webhookBody: PrismicWebhookBodyApiUpdate,
): RTE.ReaderTaskEither<Dependencies, never, string[]> =>
  pipe(
    RTE.ask<Dependencies>(),
    RTE.bindW('documentIds', () => RTE.right(webhookBody.documents)),
    RTE.bindW('releaseDocumentIds', (scope) =>
      pipe(
        [
          ...(webhookBody.releases.update || []),
          ...(webhookBody.releases.addition || []),
          ...(webhookBody.releases.deletion || []),
        ],
        A.filter((payload) => payload.id === scope.pluginOptions.releaseID),
        A.chain((payload) => payload.documents),
        RTE.right,
      ),
    ),
    RTE.map((scope) => [...scope.documentIds, ...scope.releaseDocumentIds]),
  )
