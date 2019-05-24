import Prismic from 'prismic-javascript'
import { name as pkgName } from '../package.json'

const msg = s => `${pkgName} - ${s}`

const pagedGet = async (
  client,
  query = [],
  queryOptions,
  context,
  pageSize = 100,
  page = 1,
  acc = [],
) => {
  const {
    gatsbyContext: { reporter },
  } = context

  reporter.verbose(msg(`fetching documents page ${page}`))
  const response = await client.query(query, {
    ...queryOptions,
    page,
    pageSize,
  })

  acc = acc.concat(response.results)

  if (queryOptions.page * queryOptions.pageSize < response.total_results_size)
    return pagedGet(
      client,
      query,
      queryOptions,
      context,
      pageSize,
      page + 1,
      acc,
    )

  return acc
}

export const fetchAllDocuments = async (gatsbyContext, pluginOptions) => {
  const {
    repositoryName,
    accessToken,
    fetchLinks,
    lang,
    queryPredicates,
  } = pluginOptions

  const apiEndpoint = `https://${repositoryName}.prismic.io/api/v2`
  const client = await Prismic.api(apiEndpoint, { accessToken })

  const predicates = queryPredicates(Prismic.Predicates)
  const requests = predicates.map(query =>
    pagedGet(
      client,
      query,
      { fetchLinks, lang },
      {
        gatsbyContext,
        pluginOptions,
      },
    ),
  )
  return Promise.all(requests)
}
