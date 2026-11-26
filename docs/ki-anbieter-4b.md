# Stage 4b „Eigener Schlüssel“: can a browser call the four EU providers?

Date of all tests and page reads: **2026-11-23** (curl and browser runs between 17:02 and 17:25 UTC). Scope: IONOS AI Model Hub,
Scaleway Generative APIs, OVHcloud AI Endpoints, Mistral. Builds on `docs/ki-anbieter.md` (2026-11-22) and
`PLAN.md` 4.5; what is already there is not repeated. No legal assessment.

Marking used below: **[tested]** = I ran it today and saw the output, **[read]** = I read the provider's page or
its public source today, **[inferred]** = my conclusion, **[memory]** = from my own knowledge, not checked today.

## 1 Result in short

| Provider | Browser calls | Deciding evidence | `json_schema` | Best candidate model id | Processing | Training on inputs | Price per 1M in / out | Free access |
|---|---|---|---|---|---|---|---|---|
| **IONOS AI Model Hub** | **yes** [tested] | preflight `204`, `access-control-allow-origin: *`, `access-control-allow-headers: Authorization, Content-Type`; `401` also carries `access-control-allow-origin: *` | in the API spec, „model-specific“; documented example only for Llama 3.3 70B | `mistralai/Mistral-Small-24B-Instruct` (is Mistral Small 3.2) | Germany | no, not stored | 0.10 € / 0.30 € net | none found; business customers only |
| **Scaleway Generative APIs** | **unclear** [tested] | preflight `200` with `access-control-allow-origin: https://example.org`, but `401` and `403` carry **no** `access-control-allow-origin`: both browsers report a network error. A `200` could not be tested without a key | yes, „All LLMs“ [read] | `gemma-4-26b-a4b-it` (the measured reference model), `mistral-small-3.2-24b-instruct-2506` | Paris, France | no, zero retention by default | 0.15 € / 0.35 € (Mistral Small 3.2); 0.25 € / 0.50 € (Gemma 4, from a search snippet) | 1,000,000 tokens |
| **OVHcloud AI Endpoints** | **yes today, on a tolerated deviation** [tested] | preflight `200`, `access-control-allow-origin: *`, `access-control-allow-headers: *`; `200`, `403`, `404`, `429` all carry `access-control-allow-origin: *`. The standard says `*` does not cover `Authorization`; Chromium and Firefox accept it, Chromium with a deprecation notice | yes, per model in the catalog; **obeyed in a real call** [tested] | `Mistral-Small-3.2-24B-Instruct-2506`, `gemma-4-26b-a4b` | EU; catalog says FR | no, not stored | 0.09 € / 0.28 € (Mistral Small 3.2); 0.09 € / 0.35 € (Gemma 4) | none usable (see 3.3) |
| **Mistral** | **yes** [tested], both `api.mistral.ai` and `api.eu.mistral.ai` | preflight `200`, `access-control-allow-origin: *`, `access-control-allow-headers: Authorization,Content-Type,…`; `401` carries `access-control-allow-origin: *` | yes, documented in exactly the planned shape | `mistral-small-2603` (Mistral Small 4) | EU only on `api.eu.mistral.ai` (+10 %); the global endpoint commits to no location | opt-out exists; default for paid use not stated plainly. 30 days retention unless ZDR | 0.15 $ / 0.60 $ (EU endpoint 0.165 $ / 0.66 $) | none for the API (docs); help center contradicts |

Three of the four work from a browser, so the condition for researching further candidates in depth is not met.
A quick preflight of five others is in section 4.

**The three most important findings beyond the table**

1. **Scaleway hides its auth errors from the browser.** A wrong or missing key looks like „network down“, in
   Chromium and in Firefox. Whether a correct key gets a readable answer is the one thing only a test with a real
   key can show.
2. **OVHcloud works because browsers do not yet enforce a rule of the Fetch standard.** Chromium raised the
   deprecation issue `AuthorizationCoveredByWildcard` during my call. If a browser starts enforcing it, OVHcloud
   breaks for every key at once until OVHcloud lists `Authorization` by name.
3. **Mistral's default endpoint is not an EU promise.** `api.mistral.ai` is documented as global with no committed
   location. For „Rechnen in der EU“ the product must call `api.eu.mistral.ai`, and inputs stay 30 days unless
   Mistral grants zero data retention on request.

## 2 How it was tested

**curl, as specified** (origin `https://example.org`, no key):

```
curl -s -i -X OPTIONS '<endpoint>' -H 'Origin: https://example.org' \
  -H 'Access-Control-Request-Method: POST' -H 'Access-Control-Request-Headers: authorization,content-type'
curl -s -i -X POST '<endpoint>' -H 'Origin: https://example.org' -H 'Content-Type: application/json' \
  -d '{"model":"x","messages":[{"role":"user","content":"hi"}]}'
```

**Beyond the specified commands** (each is named so you can judge it):

- **A placeholder in place of a key.** For Scaleway and OVHcloud with curl, and for all five endpoints in the
  browser test, I sent `Authorization: Bearer placeholder-not-a-key`. It is not a key and belongs to no account.
  Without an `Authorization` header a browser does not ask for that header in its preflight, so the test would
  not test what the product does.
- **Two real browsers.** A `fetch()` from the page `https://example.org` in headless Chromium 156.0.8078.4
  (Playwright's `chromium_headless_shell-1248`) and headless Firefox 154.0.1 (the installed app), each with a
  throwaway profile inside the `s2` folder, deleted afterwards. The installed Chrome 157 was not used, the
  owner's browser profiles were not touched. Safari was not tested.
- **Three anonymous inference calls at OVHcloud.** OVHcloud documents keyless use. Two calls succeeded (one per
  candidate model, a made-up three-note prompt with the planned `response_format`), the third got `429`.
  **Side effect:** the response headers say the anonymous allowance is one call per model per year and IP
  (`x-ratelimit-limit-year: 1`, `retry-after: 3307535`), so this machine's IP has no anonymous call left for
  `Mistral-Small-3.2-24B-Instruct-2506` and `gemma-4-26b-a4b` until the end of the year. Calls with a key are
  not affected.
- Firefox started with a fresh profile; I switched off telemetry and updates by preferences, but a fresh start
  may still have contacted Mozilla's services.

**What a browser needs:** an allowed origin on the preflight *and* on the actual response, and `authorization`
and `content-type` among the allowed headers. A response without `access-control-allow-origin` reaches the
network but not the script: `fetch` rejects, the status and body stay invisible.

### Browser test, all five endpoints [tested]

Same result in Chromium 156 (17:15 UTC) and Firefox 154 (17:16 UTC):

| Endpoint | Preflight | Actual request | What the script saw |
|---|---|---|---|
| IONOS `openai.inference.de-txl.ionos.com` | 204 | 401 | status 401 and the error body |
| Scaleway `api.scaleway.ai` | 200 | 403 | **`TypeError: Failed to fetch`** (Chromium: `MissingAllowOriginHeader`; Firefox: „(Grund: CORS-Kopfzeile 'Access-Control-Allow-Origin' fehlt). Statuscode: 403.“) |
| OVHcloud `oai.endpoints.kepler.ai.cloud.ovh.net` | 200 | 403 | status 403 and the error body. Chromium added the issue `DeprecationIssue … "type":"AuthorizationCoveredByWildcard"` |
| Mistral `api.mistral.ai` | 200 | 401 | status 401 and `{"detail":"Invalid API Key"}` |
| Mistral `api.eu.mistral.ai` | 200 | 401 | status 401 and `{"detail":"Invalid API Key"}` |

## 3 The four providers

Cost per wall below uses the task's figures: 6 calls × 2,000 input + 250 output tokens = 12,000 input and 1,500
output tokens.

### 3.1 IONOS AI Model Hub

**CORS: works from a browser.** [tested, 17:02 UTC] Header lines, trimmed to status and `access-control-*`:

```
OPTIONS https://openai.inference.de-txl.ionos.com/v1/chat/completions
HTTP/2 204
access-control-allow-credentials: true
access-control-allow-headers: Authorization, Content-Type
access-control-allow-methods: POST
access-control-allow-origin: *
access-control-max-age: 21600

POST, no key
HTTP/2 401
access-control-allow-credentials: true
access-control-allow-origin: *
access-control-expose-headers: X-Gateway-Version, X-Request-Id, X-RateLimit-Limit-Requests, X-RateLimit-Remaining-Requests, X-RateLimit-Reset-Requests, Retry-After, Location, Content-Location, Date, ETag
{"httpStatus":401,"messages":[{"errorCode":"paas-auth-1","message":"Unauthorized, wrong or no api key provided to process this request"}]}
```

- `allow-credentials: true` next to `*` is only a problem for requests sent with cookies. A `fetch` with an
  `Authorization` header and the default credentials mode is not one. Both browsers accepted it.
- The rate-limit headers and `Retry-After` are exposed, so the script can read them.
- **The allowed-header list is fixed, not an echo.** A preflight asking for `authorization,content-type,x-test-header`
  got the same `Authorization, Content-Type` back (17:24 UTC). A request with any further custom header fails;
  OpenAI's JavaScript client, which adds `X-Stainless-*` headers, would not work here. A plain `fetch` does.
- The documentation says nothing about browser use or CORS (13 AI Model Hub pages searched). [read]

**API.** Base URL `https://openai.inference.de-txl.ionos.com`, path `/v1/chat/completions`, „following the OpenAI
Chat Completions API wire format“. [read]

- `response_format` accepts `text`, `json_object` and `json_schema` with `name`, `schema` (both required) and
  `strict`. The spec adds: „Which formats a model supports is model-specific“ and for `strict`: „Whether it is
  honored, and its default when omitted, are model-specific.“
- A worked `json_schema` example with `strict: true` exists only on the Llama 3.3 70B page. The Mistral Small 24B
  page does not mention structured output.
- `max_tokens` and `temperature` (0 to 2) are in the spec. For reasoning models „the reasoning counts toward this
  limit“.
- **Errors are not in OpenAI's shape:** `{"httpStatus":…,"messages":[{"errorCode":…,"message":…}]}`. Only the
  `529` overload answer uses OpenAI's format.

**Models** (exact ids from the model pages) [read]

| Model id | What it is | Price per 1M in / out, net | Per wall |
|---|---|---|---|
| `mistralai/Mistral-Small-24B-Instruct` | 24B, fp8, 128k; the page links to Mistral-Small-3.2-24B-Instruct-2506 | 0.10 € / 0.30 € | 0.17 ct |
| `openai/gpt-oss-120b` | 120B, reasoning on by default (`reasoning_effort` low/medium/high) | 0.15 € / 0.65 € | 0.28 ct plus reasoning tokens |
| `meta-llama/Llama-3.3-70B-Instruct` | 70.6B, AWQ INT4, no reasoning | 0.65 € / 0.65 € | 0.88 ct |
| `Qwen/Qwen3.8-27B` | 27B, INT4, reasoning on by default, `reasoning_effort: "none"` turns it off | 0.40 € / 2.70 € | 0.89 ct |
| `Qwen/Qwen3.5-397B-A17B` | 397B, 17B active | 0.60 € / 3.60 € | 1.26 ct |

No Gemma at IONOS.

**Data** [read], <https://docs.ionos.com/cloud/ai/ai-model-hub/governance-and-compliance/data-handling>:

- „All inference is performed in IONOS CLOUD data centers in Germany, and your prompts and the generated outputs
  are processed there and nowhere else.“
- „The content of your prompts and of the outputs generated for you is never logged and is never accessed by
  IONOS CLOUD personnel. It is not written to any log or to persistent storage; it is not used to train, fine-tune
  or otherwise improve any model; and it is not disclosed to any third party, including the developers of the
  models we operate.“
- „We record metadata describing each API call: the timestamp, the model invoked and the number of tokens
  processed.“
- „No third-party sub-processors are engaged for AI Model Hub.“
- „Your data processing agreement applies as part of your contract with IONOS CLOUD and does not require separate
  signature“.
- There is no free tier, so no difference between free and paid.

**Cost and access** [read]

- Price list „v2026-10-29, Preise gültig ab 29.10.2026“:
  <https://docs.ionos.com/cloud/support/general-information/price-list/ionos-cloud-gmbh-de>. „Preise sind
  Nettopreise und verstehen sich zuzüglich etwaig anfallender gesetzlicher Umsatzsteuer.“
- **Business customers only:** „Das Angebot der IONOS CLOUD GmbH […] richtet sich ausschließlich an
  Gewerbetreibende, nicht an Verbraucher.“
- No free tier or starting credit named on the product page or in the docs.
- Sign-up needs company name, address, phone and a card or SEPA mandate. „We now manually check whether the data
  you provided is correct. […] This process can take up to 24 hours.“
- **Key:** DCD → Management → Token Manager → Generate Token. The value is shown once. It is a JWT
  (`bearerFormat: JWT` in the spec) with a lifetime of 1 hour to at most 365 days, up to 100 tokens per user.
  Length is not documented.
- **The token is not limited to the AI Model Hub.** „each authentication token grants access to modifying or using
  the corresponding IONOS CLOUD solutions“; the contract owner „can use every API endpoint of the IONOS Public
  Cloud offering“. IONOS itself suggests a separate user in a group with only „Access and manage AI Model Hub“.
  The product should say so next to the key field.
- No spend limit per token in the pages read.

**Rate limits** [read], <https://docs.ionos.com/cloud/ai/ai-model-hub/how-tos/rate-limits>: per contract and per
model, 5 requests per second sustained, bursts of up to 10 in a 2-second window. Over the limit: `429` with
`Retry-After`; platform overload: `529`. Six calls at once fit in the burst. The second request beside a slow one
goes out 12 to 15 seconds later, so it does not add to the same window.

### 3.2 Scaleway Generative APIs

**CORS: unclear, with one certain defect.** [tested, 17:02 to 17:05 UTC]

```
OPTIONS https://api.scaleway.ai/v1/chat/completions
HTTP/2 200
access-control-allow-origin: https://example.org
access-control-allow-credentials: true
access-control-allow-methods: GET, POST, OPTIONS, DELETE
access-control-allow-headers: User-Agent,X-Requested-With,X-Forwarded-For,If-Modified-Since,Cache-Control,Content-Type, Range,Authorization,Access-Control-Allow-Origin,Referer,X-Stainless-Os,X-Stainless-Runtime, X-Stainless-Runtime-Version,X-Stainless-Arch,X-Stainless-Lang,X-Stainless-Package-Version, X-Stainless-Retry-Count,X-Stainless-Timeout
access-control-max-age: 1728000

POST, no key
HTTP/2 401
(no access-control-* header at all)
{"error":{"code":401,"message":"missing 'Authorization' header","type":"unauthorized","param":""}}

POST, placeholder Authorization
HTTP/2 403
(no access-control-* header at all)
{"error":{"code":403,"message":"insufficient permissions to access the resource","type":"forbidden","param":""}}
```

- The preflight passes: the origin is echoed, `Authorization` and `Content-Type` are listed.
- **The `401` and `403` answers carry no `access-control-allow-origin`.** In both browsers `fetch` rejects with a
  network error. The product could not tell „wrong key“ from „no connection“.
- **Not tested: a `200`.** [inferred] The allowed-header list names the `X-Stainless-*` headers that OpenAI's
  JavaScript client sends, which only makes sense if browser use was intended; and the errors above come from the
  gateway (`server: envoy`) before the request reaches the model service. So a successful answer probably does
  carry the header. That is a guess until one call with a real key is made. Whether `400`, `422` and `429`
  answers carry it is equally open.
- Scaleway's documentation says nothing about browser use or CORS (14 pages of the public docs source searched).
  A web search found no third-party report either.

**API.** Base URL `https://api.scaleway.ai/v1`, path `/chat/completions`; per project
`https://api.scaleway.ai/{project_id}/v1`. „All models comply with OpenAI“. [read]

- Structured output: type `{"type": "json_schema"}`, „This mode enforces a strict schema format“. „All LLMs in the
  Scaleway library support **Structured outputs** and **JSON mode**.“ The examples pass
  `json_schema: { name, schema }`; `strict` does not appear in them.
  <https://www.scaleway.com/en/docs/generative-apis/how-to/use-structured-outputs/>
- The API reference at `www.scaleway.com` answered 403 to every fetch from here, so the parameter list
  (`max_tokens`, `strict`) is not read.

**Models** (Serverless ids as used in the docs' requests and quota tables) [read]

| Model id | What it is | Price per 1M in / out | Per wall |
|---|---|---|---|
| `gemma-4-26b-a4b-it` | **the model measured at Cloudflare**; bf16; reasoning efforts `none`, `low`, `medium`, `high` | 0.25 € / 0.50 € (search snippet only) | 0.38 ct |
| `mistral-small-3.2-24b-instruct-2506` | 24B, fp8, 128k, no reasoning | 0.15 € / 0.35 € | 0.23 ct |
| `llama-3.3-70b-instruct` | 70B, 100k context | not read | – |
| `qwen3.6-35b-a3b`, `qwen3.8-27b` | reasoning models, effort `none` possible | not read | – |
| `gpt-oss-120b` | Scaleway recommends the Responses API for it | not read | – |
| `mistral-medium-3.5-128b`, `qwen3.5-397b-a17b` | larger | 0.60 € / 3.60 € for Qwen3.5-397b | – |

**Data** [read], <https://www.scaleway.com/en/docs/generative-apis/reference-content/data-privacy/> (read from the
public docs source, validated 2025-10-03):

- „By default we apply a Zero Data Retention Policy“.
- „We do not collect, read, reuse, or analyze the content of your inputs, prompts, or outputs generated by the
  API. The only exception being when your traffic harms our service operations […] In this case, we may store
  temporarily the corresponding HTTP request content“; „Data is stored for up to two weeks“, for example after an
  HTTP 500, „occurring very rarely (1 out of a million requests)“.
- „Your data is not used for training, retraining, or improving the base models.“
- Location, FAQ: „All *Serverless models* are currently hosted in a secure data center located in Paris, France,
  operated by OPCORE. […] In the future, we may add further locations in other European regions“.
- Prompt caching „cannot be disabled“, is „isolated per project“ and „does not store prompt content itself“.
- No different rules for the free tier are stated.

**Cost and access** [read unless marked]

- Prices: the pricing page answered 403. From the docs FAQ: `mistral-small-3.2-24b-instruct-2506` 0.15 € input,
  0.35 € output per million; `qwen3.5-397b-a17b` 0.60 € / 3.60 €. Gemma 4 at 0.25 € / 0.50 € comes from a
  search-engine summary of the pricing page, not from the page. Whether prices exclude VAT: not read.
- Free tier: „up to 1,000,000 tokens for models billed by tokens“. The FAQ does not say whether once or per month.
- A payment method is needed [inferred]: the quota table has only the columns „Payment method validated“ and
  „Payment method and identity validated“.
- **Key:** Console → IAM & API keys → API keys → Generate API key, with an expiry of the user's choice. The secret
  key is a UUID (docs example `720438f9-fcb9-4ebb-80a7-808ebf15314b`, 36 characters, no prefix).
- **The key carries the rights of its bearer**, which for the account owner is the whole account. A narrow key
  needs an IAM application with the permission set `GenerativeApisModelAccess`.
- **Spend limit: yes, since 2026-10-19.** „User budgets“, „Enforced at: API key / End user“, „Daily / Monthly
  allowance ($ or tokens)“, set in the console. Billing alerts exist too.

**Rate limits** [read], with a validated payment method: 300 requests per minute and 200,000 tokens per minute
per model, 100 concurrent requests for all models. With verified identity: 600 requests and, for Gemma 4 and
Mistral Small 3.2, 2,000,000 tokens per minute. Six calls at once are far below that.

### 3.3 OVHcloud AI Endpoints

**CORS: works today in Chromium and Firefox, on behaviour the standard does not allow.** [tested, 17:02 to 17:14 UTC]

```
OPTIONS https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/chat/completions
HTTP/2 200
access-control-allow-origin: *
access-control-allow-headers: *
access-control-allow-methods: GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS,TRACE,CONNECT

POST, no key, model "x"
HTTP/2 404
access-control-allow-origin: *
access-control-expose-headers: ratelimit-limit,ratelimit-remaining,ratelimit-reset,retry-after
{"error":{"code":"model_not_found","message":"The model `x` does not exist.","param":null,"type":"invalid_request_error"}}

POST, placeholder Authorization
HTTP/2 403
access-control-allow-origin: *
access-control-expose-headers: ratelimit-limit,ratelimit-remaining,ratelimit-reset,retry-after
{"message":"Forbidden: authentication failed.  Please generate a new one at https://kepler.ai.cloud.ovh.net/v1/oauth/ovh/authorize?iam_action=publicCloudProject:ai:endpoints/call"}

POST, no key, real model (anonymous use)
HTTP/2 200
access-control-allow-origin: *
access-control-expose-headers: ratelimit-limit,ratelimit-remaining,ratelimit-reset,retry-after
(also: ratelimit-limit: 1, ratelimit-remaining: 0, x-ratelimit-limit-year: 1)

POST, no key, second call
HTTP/2 429
access-control-allow-origin: *
access-control-expose-headers: ratelimit-limit,ratelimit-remaining,ratelimit-reset,retry-after
(also: retry-after: 3307535)
{"message":"API rate limit exceeded", …}
```

- Every answer I could provoke carries `access-control-allow-origin: *`, **including a real `200`**. This is the
  only provider where the whole path, preflight to successful answer, is verified.
- **The catch is `access-control-allow-headers: *`.** The Fetch standard treats `Authorization` as the one request
  header a wildcard does not cover. Browsers do not enforce that yet:
  - Chromium 156 let the request through and raised `DeprecationIssue … AuthorizationCoveredByWildcard`. [tested]
  - Firefox 154 let it through. [tested] MDN's compatibility data lists the enforcement in Firefox 115 behind the
    preference `network.cors_preflight.authorization_covered_by_wildcard`, and for Chrome and Safari as not
    implemented. [read]
  - whatwg/fetch issue #1919 of 2026-04-07, „Disallowing `Authorization` in CORS-preflight wildcards is currently
    not web compatible“: „The current spec disallows this, but Firefox, Chrome and Safari allow it.“ [read]
  - So it works, and it may stop without notice from OVHcloud's side. Safari is covered by those two sources only.
- No `access-control-max-age`: the browser repeats the preflight after its default of 5 seconds.
- The documentation says nothing about browser use or CORS.

**API.** Base URL `https://oai.endpoints.kepler.ai.cloud.ovh.net/v1`, path `/chat/completions`. „AI Endpoints is
designed to be compatible with the OpenAI API“. [read]

- „Structured Outputs (JSON Schema): Builds on JSON Mode by enforcing a specified JSON schema“. Support is per
  model; the public catalog lists `response_format: ["raw_text","json_object","json_schema"]` for every candidate
  below. [read]
- **Verified with a real call** [tested]: system + user message, `temperature: 0`, `max_tokens: 200`,
  `response_format: { type: "json_schema", json_schema: { name, strict: true, schema } }` with an enum of topic
  letters. `Mistral-Small-3.2-24B-Instruct-2506` answered `200` with valid JSON matching the schema,
  `finish_reason: "stop"`, 53 prompt and 67 completion tokens.
- **`gemma-4-26b-a4b` returned no answer in the same call:** all 200 tokens went into `reasoning`,
  `finish_reason: "length"`, no `content`. Reasoning is on by default there and counts against `max_tokens`. The
  catalog lists the efforts `low`, `medium`, `high` for it and no `none`. The planned 250 output tokens are too
  few for this model at this provider unless reasoning can be reduced.
- Errors are in OpenAI's shape for model errors, in a plain `{"message":…}` shape for gateway errors (403, 429).

**Models** (ids as `/v1/models` names them; prices from the public catalog API, in euros) [tested/read]

| Model id | What it is | Price per 1M in / out | Per wall |
|---|---|---|---|
| `Mistral-Small-3.2-24B-Instruct-2506` | 24B, bf16, 128k, no reasoning, datacenter FR | 0.09 € / 0.28 € | 0.15 ct |
| `gemma-4-26b-a4b` | **the reference model's weights**, but NVFP4 quantised (`nvidia/Gemma-4-26B-A4B-NVFP4`), in the catalog since 17.11.2026, datacenter FR | 0.09 € / 0.35 € | 0.16 ct plus reasoning tokens |
| `gpt-oss-120b` | reasoning | 0.08 € / 0.40 € | 0.16 ct plus reasoning tokens |
| `qwen3.6-35b-a3b` | reasoning | 0.17 € / 1.15 € | 0.38 ct plus reasoning tokens |
| `Qwen3.8-27B` | reasoning, effort `none` listed | 0.40 € / 2.70 € | 0.89 ct |
| `Meta-Llama-3_3-70B-Instruct` | the catalog marks it `available: false` | 0.67 € / 0.67 € | – |

`/v1/models` itself reports a price of 0 for `gemma-4-26b-a4b`; the catalog API and the catalog page say
0.09 € / 0.35 €. I took the catalog.

**Data** [read]

- Product page, <https://www.ovhcloud.com/en-ie/public-cloud/ai-endpoints/>: „Our AI Endpoints services are hosted
  and run in the European Union. Your data is never used to train our models, and we only keep what is strictly
  necessary for billing.“
- Docs, <https://docs.ovhcloud.com/en/guides/public-cloud/ai-machine-learning/ai-endpoints-capabilities>
  (updated 2026-11-10): „Our infrastructure, hosted in Europe, adheres to European data protection regulations.
  Data is not stored or shared during or after model use“.
- Getting started: „we do not store user data.“
- Location per model, catalog API `metadata.deployment_information.datacenters`: `country_code: "FR"` for both
  main candidates.
- The contract text (Public Cloud Special Conditions, Appendix 10) was not opened.

**Cost and access** [read unless marked]

- Whether the catalog prices exclude VAT is not stated on the pages read.
- A payment method is required: „Access keys created from Public Cloud projects in Discovery mode (without a
  payment method) cannot use the service.“
- New Public Cloud accounts are offered „€200 free credit“ for a first project, as a time-limited voucher. Whether
  it covers AI Endpoints was not checked.
- **Anonymous use is not a free tier.** The docs say „Anonymous: 2 requests per minute, per IP and per model.“ The
  service answered with `x-ratelimit-limit-year: 1` and rejected my second call for 38 days. [tested] The two
  contradict; the headers are what the service does.
- **Key:** OVHcloud Console → Public Cloud project → AI Endpoints → API keys → Create an API key. „the key value is
  displayed only once“. Keys are „linked to a Public Cloud project“ and have „adjustable validity periods“. The
  error message names the right the key carries: `publicCloudProject:ai:endpoints/call`. Format and length are
  not documented.
- **No spend limit:** „the AI Endpoints platform does not impose any usage limits for API requests, apart from the
  rate and payload size limiting. However, we are considering introducing a usage limit feature in the future.“

**Rate limits** [read]: „Authenticated with an API access key: 400 requests per minute, per Public Cloud project
and per model.“ Request bodies up to 2 MB. Six calls at once are no issue.

### 3.4 Mistral

**CORS: works from a browser, on both endpoints.** [tested, 17:02 and 17:11 UTC]

```
OPTIONS https://api.mistral.ai/v1/chat/completions      (identical for https://api.eu.mistral.ai/…)
HTTP/2 200
access-control-allow-origin: *
access-control-allow-headers: Authorization,Content-Type,User-Agent,Cache-Control,Keep-Alive,X-Mistral-User-Agent,X-External-Organization-Id,X-External-Workspace-Id
access-control-allow-methods: GET,HEAD,PUT,PATCH,POST,OPTIONS,DELETE
access-control-max-age: 3600

POST, no key
HTTP/2 401
access-control-allow-origin: *
{"detail":"Invalid API Key"}
```

- No `access-control-expose-headers` on the `401`: whether a script can read rate-limit headers on other answers
  is not tested.
- The documentation says nothing about calling the API from a browser (full docs text searched; the only CORS
  mention concerns MCP servers).

**API.** `https://api.mistral.ai/v1/chat/completions` (global) and `https://api.eu.mistral.ai/v1/chat/completions`
(EU). OpenAI-style, Mistral's own API. [read]

- Structured output is documented in exactly the planned shape, with `max_tokens: 256` and `temperature: 0` in the
  curl example: `"response_format": { "type": "json_schema", "json_schema": { "schema": {…}, "name": "book",
  "strict": true } }`. „All currently available models except for `codestral-mamba` are supported.“
  <https://docs.mistral.ai/inference/conversations/structured-output/custom>
- Errors are in Mistral's shape (`{"detail":…}`).
- `mistral-small-2603` takes `reasoning_effort`; with `"none"` „the thinking chunk is omitted from the response“.

**Models** [read]

| Model id | What it is | Price per 1M in / out | Per wall |
|---|---|---|---|
| `mistral-small-2603` (alias `mistral-small-latest`) | Mistral Small 4, „119B parameters with 6.5B active“, 256k, GA | 0.15 $ / 0.60 $ | 0.27 US-ct; 0.30 on the EU endpoint |
| `mistral-large-4` | Mistral Large 4, 1M context | 0.70 $ / 2.10 $ | 1.2 US-ct |
| `mistral-medium-3-5` | deprecated 2026-10-31, retires 2027-04-30 | – | – |
| `mistral-small-2506` | Mistral Small 3.2, deprecated 2026-04-30, retired 2026-07-31 | – | – |

Mistral no longer serves the 24B Small that Cloudflare, IONOS, Scaleway and OVHcloud host. Small 4 is a different
model and needs its own measurement.

**Data** [read]

- **Location.** <https://docs.mistral.ai/inference/regional-inference>: for `api.mistral.ai` „Mistral does not
  commit to a specific inference location for requests sent to this endpoint.“ For `api.eu.mistral.ai`: „Multiple
  data centers in EU and EFTA countries“, „billed at **1.1× standard list pricing**“. „Available models vary by
  region.“ Control-plane data „may still be handled by Mistral systems outside the selected inference geography“.
  The help center says more loosely „By default, your data is hosted in the European Economic Area (EEA).“ The
  two do not say the same thing; the docs page is the specific and newer one.
- **Retention.** Privacy policy, effective September 3, 2026, <https://legal.mistral.ai/terms/privacy-policy>:
  „Except for specific APIs, we keep your Input and Output for the period necessary to generate the Output and
  then for thirty (30) rolling days to monitor abuse (unless zero data retention is activated).“
- **Zero data retention** is not a setting: „ZDR is available only with pay-as-you-go and only for stateless API
  calls“; „We review each request and may approve or deny it.“ `/v1/chat/completions` is covered.
  <https://docs.mistral.ai/admin/monitor-comply/zero-data-retention>
- **Training.** Commercial terms, effective September 25, 2026, 4.2: „Mistral AI will not use Customer Data or
  Outputs to train its artificial intelligence models except (a) when you (i) opted-in to training on a Mistral AI
  Product set to opt-out by default or (ii) have not opted-out of training on a Mistral AI Product set to opt-in
  by default“. Help center, Studio: Free mode „we may use your data (input and output) to train our artificial
  intelligence models“; pay-as-you-go „Customers retain full control over this processing and have the right to
  opt out at any time.“ **Which default applies to the paid API is not stated in any sentence I found.** The
  switch is Admin → Privacy → „Data usage for improving our services“. Labs and preview models are always used
  for training.
- Free versus paid: the training sentence above differs; ZDR needs pay-as-you-go.

**Cost and access** [read unless marked]

- Prices in US dollars: <https://docs.mistral.ai/inference/pricing>. „Prepaid API credits are purchased without
  VAT.“
- **Free access contradicts itself.** Docs: „Free mode […] doesn't include API access. Creating API keys and using
  the API require billing activation and pay-as-you-go.“ Help center: „Free mode (the default) has the lowest
  limits, intended for evaluation and prototyping.“ Not resolved without an account.
- Pay-as-you-go is prepaid: credits bought in advance; at a zero balance requests fail with `402`.
- **Key:** Studio → API Keys → New key, with name and expiry; „The full key appears only once.“ Keys are scoped to
  a workspace. Format is not documented; from [memory] 32 letters and digits without a prefix.
- **Spend limit: per workspace, not per key.** „A monthly spending limit caps API and Vibe consumption for one
  Workspace.“ A workspace of its own with one key and a cap comes to the same.

**Rate limits** [read]: three limits per model, set per organisation: requests per second, tokens per minute,
tokens per month. The numbers are shown only in the admin panel. Tiers rise with the billed total: Tier 1 on
enabling pay-as-you-go, Tier 2 over 20 €, Tier 3 over 100 €, Tier 4 over 500 €. **Whether Tier 1 allows six
requests in the same second is not known.**

## 4 Further candidates, preflight only

Not needed by the task's rule, since three of four work. One curl pair each, 17:17 UTC, nothing else researched.

| Candidate | Endpoint | Preflight | Keyless POST | Browser |
|---|---|---|---|---|
| Nebius Token Factory | `api.tokenfactory.nebius.com/v1/chat/completions` (same on `api.studio.nebius.com`) | 204, `access-control-allow-origin: *`, `access-control-allow-headers: authorization,content-type` | 401 with `access-control-allow-origin: *` | would work |
| T-Systems LLM Hub | `llm-server.llmhub.t-systems.net/v2/chat/completions` | 200, origin echoed, `access-control-allow-headers: authorization,content-type` | 403 with `access-control-allow-origin: *` | would work |
| STACKIT AI Model Serving | `api.openai-compat.model-serving.eu01.onstackit.cloud/v1/chat/completions` | 403, no `access-control-*` | 403, none | does not |
| Infomaniak AI Tools | `api.infomaniak.com/2/ai/1/openai/v1/chat/completions` (made-up product id) | 200, no `access-control-*` | 401, none | does not |

## 5 What follows for stage 4b

**Start with IONOS and OVHcloud, add Mistral with an honest label, hold Scaleway until one keyed test.**

1. **IONOS AI Model Hub**, `mistralai/Mistral-Small-24B-Instruct`. The cleanest CORS of the four, processing in
   Germany only, the plainest wording on storage and training, 0.17 ct per wall. To settle: `json_schema` for this
   model is not documented, only the spec and an example for Llama. To say in the product: business customers
   only, unlock takes up to a day, the token expires after at most 365 days and should belong to a restricted
   user.
2. **OVHcloud AI Endpoints**, `Mistral-Small-3.2-24B-Instruct-2506`. The only provider where preflight, success
   answer and the planned `response_format` are all verified, at the lowest price (0.15 ct). It also hosts the
   reference model, but that one needs a higher `max_tokens` or reduced reasoning first. The risk to accept
   knowingly: the wildcard for `Authorization`. A check in the product that reports a failed preflight as such
   would make a later break visible.
3. **Mistral**, `mistral-small-2603` on `api.eu.mistral.ai`. Technically the easiest: documented shape, prepaid
   credits, a cap per workspace, open to private persons. It fits the promise of 4.5 worst: 30 days retention
   unless Mistral grants ZDR, training default unclear, 10 % surcharge for the EU endpoint. If it is in the list,
   the wall should say „30 Tage gespeichert“ for it, not „ohne Speicherung“.
4. **Scaleway** has the best data terms next to IONOS, the reference model under its own name, a free million
   tokens and budgets per key. It waits on one question: does a `200` carry `access-control-allow-origin`? Even
   if yes, a wrong key will show as a network error, and the product has to word that case for Scaleway.

**Details that affect the build**

- `connect-src` would need: `https://openai.inference.de-txl.ionos.com`, `https://oai.endpoints.kepler.ai.cloud.ovh.net`,
  `https://api.eu.mistral.ai`, and `https://api.scaleway.ai` if Scaleway joins.
- Send only `Authorization` and `Content-Type`. IONOS allows exactly these two.
- **Reasoning eats `max_tokens`.** Gemma 4 at OVHcloud, gpt-oss-120b and the Qwen models reason by default. The
  measured recipe at Cloudflare cannot be carried over with 250 output tokens without checking this per provider.
- **Three error shapes:** IONOS `{"httpStatus","messages":[{"errorCode"}]}`, Mistral `{"detail"}`, OVHcloud and
  Scaleway OpenAI-like or `{"message"}`.
- **A key is more than an AI key** at IONOS and Scaleway unless the user makes a restricted one. At OVHcloud and
  Mistral the key is narrow by construction.

## 6 Not verified

- **Scaleway:** whether `200`, `400`, `422` and `429` answers carry `access-control-allow-origin`. The pricing
  page and the API reference (HTTP 403 from here): Gemma 4's price is from a search snippet, VAT unknown, `strict`
  and `max_tokens` not read. Whether the free million tokens are once or monthly.
- **IONOS:** `json_schema` with `mistralai/Mistral-Small-24B-Instruct`; token length; whether any free credit
  exists; whether a spend limit exists.
- **OVHcloud:** behaviour with a valid key (same gateway, so probably the same headers); whether `gemma-4-26b-a4b`
  accepts a lower `reasoning_effort` and how many tokens it then needs; VAT; key format; whether the 200 € voucher
  covers AI Endpoints; the contract appendix; why `/v1/models` shows price 0 for Gemma.
- **Mistral:** the default of the training switch for paid API use; the requests-per-second limit of Tier 1;
  whether `mistral-small-2603` is served on `api.eu.mistral.ai`; whether Free mode can call the API; key format;
  whether ZDR is granted to a single person.
- **Browsers:** Safari and all mobile browsers; the installed Chrome 157 (tested was Chromium 156 headless). No
  call with a real key in any browser.
- **Quality:** no model at any of the four is measured on the corpus. Mistral Small 3.2 is close to the 3.1
  measured at Cloudflare (ARI 0.73); Gemma 4 at OVHcloud is a different quantisation than at Cloudflare; Mistral
  Small 4 is a different model.
- **Contracts:** no data processing agreement was opened. IONOS says its agreement is part of the contract.
- **Law:** nothing here is a legal assessment.

## 7 Sources (all read or called on 2026-11-23)

**Browser behaviour**

- MDN compatibility data, `Access-Control-Allow-Headers`:
  <https://raw.githubusercontent.com/mdn/browser-compat-data/main/http/headers/Access-Control-Allow-Headers.json>
- whatwg/fetch issue #1919, mail of 2026-04-07:
  <https://lists.w3.org/Archives/Public/public-webapps-github/2026Apr/0064.html>

**IONOS**

- Data handling: <https://docs.ionos.com/cloud/ai/ai-model-hub/governance-and-compliance/data-handling>
- Rate limits: <https://docs.ionos.com/cloud/ai/ai-model-hub/how-tos/rate-limits>
- Access management: <https://docs.ionos.com/cloud/ai/ai-model-hub/how-tos/access-management>
- Token Manager: <https://docs.ionos.com/cloud/set-up-ionos-cloud/management/identity-access-management/token-manager>
- API spec, chat completions: <https://docs.ionos.com/cloud/api-reference/ai/ai-model-hub/chat-completions/create-chat-completion>
- Models: <https://docs.ionos.com/cloud/ai/ai-model-hub/models/llms> and the pages under it
  (`mistral-small-24b`, `meta-llama-3-3-70b`, `openai-gpt-oss-120b`, `qwen3-8-27b`, `qwen3-5-397b`)
- Error codes: <https://docs.ionos.com/cloud/ai/ai-model-hub/error-codes>
- Price list: <https://docs.ionos.com/cloud/support/general-information/price-list/ionos-cloud-gmbh-de>
- Product page: <https://cloud.ionos.de/managed/ai-model-hub>

**Scaleway** (docs read from the public source <https://github.com/scaleway/docs-content>, `pages/generative-apis/`,
because `www.scaleway.com` answered 403)

- Data privacy: <https://www.scaleway.com/en/docs/generative-apis/reference-content/data-privacy/>
- Structured outputs: <https://www.scaleway.com/en/docs/generative-apis/how-to/use-structured-outputs/>
- Supported models: <https://www.scaleway.com/en/docs/generative-apis/reference-content/supported-models/>
- Rate limits: <https://www.scaleway.com/en/docs/generative-apis/reference-content/rate-limits/>
- Organization quotas: <https://www.scaleway.com/en/docs/organizations-and-projects/organization/organization-quotas/>
- FAQ: <https://www.scaleway.com/en/docs/generative-apis/faq/>
- Using the API, errors: <https://www.scaleway.com/en/docs/generative-apis/api-cli/using-generative-apis/>,
  <https://www.scaleway.com/en/docs/generative-apis/api-cli/understanding-errors/>
- API keys: <https://www.scaleway.com/en/docs/iam/credentials/create-api-keys/>
- Not fetched (403): <https://www.scaleway.com/en/pricing/model-as-a-service/>,
  <https://www.scaleway.com/en/developers/api/generative-apis/>

**OVHcloud**

- Capabilities and limits: <https://docs.ovhcloud.com/en/guides/public-cloud/ai-machine-learning/ai-endpoints-capabilities>
- Getting started: <https://docs.ovhcloud.com/en/guides/public-cloud/ai-machine-learning/ai-endpoints-getting-started>
- Structured output: <https://docs.ovhcloud.com/en/guides/public-cloud/ai-machine-learning/ai-endpoints-structured-output>
- Catalog API (docs and the API itself): <https://docs.ovhcloud.com/en/guides/public-cloud/ai-machine-learning/ai-endpoints-catalog-api>,
  <https://catalog.endpoints.ai.ovh.net/rest/v1/models_v2>
- Model list: <https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/models>
- Billing and lifecycle: <https://docs.ovhcloud.com/en/guides/public-cloud/ai-machine-learning/ai-endpoints-billing>
- Product and catalog pages: <https://www.ovhcloud.com/en-ie/public-cloud/ai-endpoints/>,
  <https://www.ovhcloud.com/de/public-cloud/ai-endpoints/catalog/mistral-small-3-2-24b-instruct-2506/>,
  <https://www.ovhcloud.com/de/public-cloud/ai-endpoints/catalog/gemma-4-26b-a4b/>

**Mistral** (docs read from <https://docs.mistral.ai/llms-full.txt>)

- Structured output: <https://docs.mistral.ai/inference/conversations/structured-output/custom>
- Regional inference: <https://docs.mistral.ai/inference/regional-inference>
- Zero data retention: <https://docs.mistral.ai/admin/monitor-comply/zero-data-retention>
- Models, Small 4, pricing, reasoning: <https://docs.mistral.ai/models>,
  <https://docs.mistral.ai/models/mistral-small-4-0-26-03>, <https://docs.mistral.ai/inference/pricing>,
  <https://docs.mistral.ai/inference/conversations/reasoning>
- API keys, limits, billing: <https://docs.mistral.ai/admin/identity-access/api-keys>,
  <https://docs.mistral.ai/admin/billing-usage/usage-limits>, <https://docs.mistral.ai/admin/workspaces/usage-limits>,
  <https://docs.mistral.ai/admin/billing-usage/billing>
- Privacy policy, commercial terms, DPA: <https://legal.mistral.ai/terms/privacy-policy>,
  <https://legal.mistral.ai/terms/commercial-terms-of-service>, <https://legal.mistral.ai/terms/data-processing-addendum>
- Help center: <https://help.mistral.ai/en/articles/347617-do-you-use-my-user-data-to-train-your-artificial-intelligence-models>,
  <https://help.mistral.ai/en/articles/455207-can-i-opt-out-of-my-input-or-output-data-being-used-for-training>,
  <https://help.mistral.ai/en/articles/347612-can-i-activate-zero-data-retention-zdr>,
  <https://help.mistral.ai/en/articles/347629-where-do-you-store-my-data-or-my-organization-s-data>,
  <https://help.mistral.ai/en/articles/698531-why-am-i-hitting-api-rate-limits-and-how-do-i-increase-them>
