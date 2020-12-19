import * as RTE from 'fp-ts/ReaderTaskEither'
import * as T from 'fp-ts/Task'
import { pipe } from 'fp-ts/function'

import {
  Dependencies,
  PrismicClient,
  PrismicClientQueryOptions,
  PrismicDocument,
  ResolveType,
} from '../types'
import { QUERY_PAGE_SIZE } from '../constants'

import { getRef } from './getRef'
import { createClient } from './createClient'

const queryByIds = (
  client: PrismicClient,
  ids: string[],
  queryOptions: PrismicClientQueryOptions,
): T.Task<ResolveType<ReturnType<PrismicClient['getByIDs']>>> => (): ReturnType<
  typeof client.getByIDs
> => client.getByIDs(ids, queryOptions)

const aggregateQueryByIds = (
  client: PrismicClient,
  ids: string[],
  queryOptions: PrismicClientQueryOptions,
  page = 1,
  docs: PrismicDocument[] = [],
): T.Task<PrismicDocument[]> =>
  pipe(
    queryByIds(client, ids, {
      ...queryOptions,
      page,
      pageSize: QUERY_PAGE_SIZE,
    }),
    T.bind('aggregateResults', (response) =>
      T.of([...docs, ...response.results]),
    ),
    T.chain((scope) =>
      page * QUERY_PAGE_SIZE < scope.total_results_size
        ? aggregateQueryByIds(
            client,
            ids,
            queryOptions,
            page + 1,
            scope.aggregateResults,
          )
        : T.of(scope.aggregateResults),
    ),
  )

/**
 * Queries documents in a list of document IDs from a Prismic repository using
 * the environment's configuration. The following fields from the environment's
 * `pluginOptions` are used, in addition to those used in `createClient`:
 *
 * - `pluginOptions.releaseID`: Prismic Release ID from which to fetch
 *   documents. If not provided, the master ref is used.
 *
 * - `pluginOptions.fetchLinks`: List of document link fields to fetch.
 *
 * - `pluginOptions.lang`: Language of documents to fetch. If not provided, all
 *   languages are fetched.
 *
 * @see gatsby-source-prismic/lib/createClient.ts
 *
 * @param ref Optional ref used to query all documents (e.g. a ref of a
 * preview). If `ref` is not provided, the ref provided in the
 * environment's plugin options will be used. If the environment's plugin
 * options does not have a ref, the master ref is used.
 *
 * @returns List of Prismic documents.
 */
export const queryDocumentsByIds = (
  ids: string[],
  ref?: string,
): RTE.ReaderTaskEither<Dependencies, never, PrismicDocument[]> =>
  pipe(
    RTE.ask<Dependencies>(),
    RTE.chain((deps) =>
      pipe(
        RTE.right({}),
        RTE.bind('client', createClient),
        RTE.bind('ref', ({ client }) => (ref ? RTE.of(ref) : getRef(client))),
        RTE.map(({ client, ref }) =>
          aggregateQueryByIds(client, ids, {
            ref,
            fetchLinks: deps.pluginOptions.fetchLinks,
            lang: deps.pluginOptions.lang,
          }),
        ),
        RTE.chain((docs) => RTE.fromTask(docs)),
      ),
    ),
  )
