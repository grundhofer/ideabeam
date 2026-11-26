# Stage 4b „Eigener Schlüssel“: can a browser call OpenAI, Anthropic and Google Gemini?

Date of all tests and page reads: **2026-11-23** (curl runs 19:38 to 19:57 UTC, Chromium 19:41 UTC, Firefox 19:41 UTC).
Scope: OpenAI (`api.openai.com`), Anthropic (`api.anthropic.com`), Google Gemini with an AI Studio key
(`generativelanguage.googleapis.com`). Builds on `docs/ki-anbieter-4b.md` (the four EU providers) and `PLAN.md` 4.5;
what is there is not repeated. No legal assessment. Nothing was signed up for, no real key was sent.

Marking: **[tested]** = I ran it today and saw the output, **[read]** = I read the provider's page or its public
source today, **[inferred]** = my conclusion, **[memory]** = from my own knowledge, not checked today.

Raw evidence is kept beside this file in `raw/`: the curl outputs (`openai-curl.txt`, `anthropic-curl.txt`,
`google-curl.txt`, `extra-curl.txt`), the two browser scripts with their outputs, and the documentation pages as
fetched today (`raw/dl/`, 4 MB).

## 1 Result in short

| | OpenAI | Anthropic | Google Gemini |
|---|---|---|---|
| **Browser calls** | **yes** [tested] | **yes, with one extra header** [tested]; **not for organisations with zero data retention or the Compliance API** [read] | **yes** [tested], with exactly the headers `content-type, x-goog-api-key` |
| Deciding header line | preflight `200`, `access-control-allow-origin: https://example.org`, `access-control-allow-headers: authorization,content-type`; `401` carries `access-control-allow-origin: *` | preflight `200`, `access-control-allow-origin: *`, only when `anthropic-dangerous-direct-browser-access` is among the requested headers; without it `400 Disallowed CORS origin`. `401` carries `access-control-allow-origin: *` only when the request sends that header | preflight `200`, `access-control-allow-origin: https://example.org`, `access-control-allow-headers: content-type,x-goog-api-key`; `400` carries `access-control-allow-origin: https://example.org` |
| Error answer readable by the page | yes, status 401 and body | yes, status 401 and body, all headers (`access-control-expose-headers: *`) | yes, status 400 and body |
| API to call | `POST https://api.openai.com/v1/chat/completions` (today's shape) or `/v1/responses` | `POST https://api.anthropic.com/v1/messages` | `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` |
| JSON by schema | `response_format: { type: "json_schema", json_schema: { name, strict: true, schema } }`, unchanged | `output_config: { format: { type: "json_schema", schema } }` | `generationConfig: { responseFormat: { text: { mimeType: "APPLICATION_JSON", schema } } }` |
| Both schemas unchanged? | **yes** by the documented subset [read] | **no**: `minItems: 3` and `maxItems: 6` are refused with 400; the assignment schema passes the documented limits [read] | **yes** by the documented subset [read] |
| Cheapest plausible model | `gpt-6-luna`, $0.10 / $0.50, **0.23 ct per wall** with `reasoning_effort: "none"` | `claude-haiku-5-5`, $0.10 / $0.50, **0.23 ct per wall** with thinking disabled | `gemini-3.5-flash-lite`, $0.30 / $2.50, **0.83 ct per wall** plus thinking at `minimal` (cannot be switched off) |
| Default mid-tier model | `gpt-6.2-sol`, $2 / $10, **4.5 ct** plus reasoning (cannot be `none`), about 6 ct | `claude-sonnet-5-5`, $2 / $10, **4.5 ct** without up-front thinking; Anthropic's own „start here“ is `claude-opus-5-5`, $4 / $20, 9 ct plus thinking, about 12 ct | `gemini-4-hydrogen`, $1.50 / $7.50, **3.4 ct** plus thinking (lowest level `low`), about 4.5 ct |
| Where processed | no location promised by default; EU only with an EU project (`eu.api.openai.com`, +10 %), for which an organisation must become eligible through sales | „any available geography“ by default; the only other choice is US-only (+10 %). No EU option | no location promised, no choice with an AI Studio key |
| How long kept | up to 30 days (abuse monitoring logs) | within 30 days deleted; up to 2 years if flagged | 55 days (abuse monitoring); new projects also log calls for the key's owner, 55 days by default |
| Training on inputs | no, unless opted in | no, by default | paid key: no. Free key: **yes, and human reviewers may read it**, except for users in the EEA, Switzerland and the UK |
| Zero retention | on approval by OpenAI only | by contract through sales only, and then **browser calls are refused** | not offered with an AI Studio key („use Vertex AI“) |
| How to get a key | platform.openai.com → API keys; prepaid credit from $5 | platform.claude.com → API keys → Create key; prepaid credit | aistudio.google.com → API keys; free tier without payment, paid tier needs prepaid credit from $5 |

Cost per wall uses the task's figures: 15,000 input and 1,500 output tokens. „About“ adds an assumed 250 reasoning
tokens per call (1,500 per wall), which is my assumption and not measured.

**The findings that matter most beyond the table**

1. **All three work from a browser today**, in Chromium 156 and Firefox 154, and a wrong key comes back as a
   readable error, not as „network down“. This is better than Scaleway and cleaner than OVHcloud. [tested]
2. **Anthropic refuses the themes schema as it stands.** Its structured outputs support `minItems` only with the
   values 0 and 1 and no `maxItems`; anything else is a 400. The schema needs a copy without the two bounds for
   Anthropic; the product's own check already enforces 3 to 6. [read]
3. **`temperature: 0` has to go for all three.** Anthropic answers 400 to any non-default `temperature` on current
   models. OpenAI's guide says to remove it whenever reasoning effort is not `none`, and always for `gpt-6.2-sol`.
   Google ignores it on current models and announces a 400 for later ones. `seed` exists only at OpenAI. [read]
4. **Every candidate reasons by default**, and reasoning tokens count against the output limit and the price.
   It can be switched off at `gpt-6-luna` (`reasoning_effort: "none"`) and `claude-haiku-5-5`
   (`thinking: { type: "disabled" }`), reduced but not removed at Google (`minimal`), and not removed at
   `gpt-6.2-sol`, `claude-opus-5-5` and `gemini-4-hydrogen`. 250 output tokens are too few wherever it stays on. [read]
5. **Anthropic and zero retention exclude each other in a browser.** An organisation with zero data retention or
   the Compliance API gets `401 … CORS requests are not allowed for this Organization`, with a valid key. So the
   wall can never say „ohne Speicherung“ for Anthropic, and such a facilitator has to be told why the key fails. [read]
6. **Google is strict about headers, and its recommended API does not fit.** The preflight allows a fixed list;
   any other header gets `403`. The Interactions API, which Google now recommends, is documented with an
   `Api-Revision` header that the preflight refuses, and it stores requests by default. `generateContent`,
   called „legacy“ and „fully supported“, works. [tested, read]
7. **A free Google key is a different product for data:** used to improve Google's products and readable by
   reviewers outside the EEA, Switzerland and the UK. Google's terms also say the API is „for professional or
   business purposes, not for consumer use“ and allow only Paid Services for clients offered to users in the EEA.
   [read]
8. **None of the three is an EU promise.** With the owner's decision that the list is no longer EU-only, the line
   at the button has to say so per provider (section 5).

## 2 How it was tested

**curl, as specified** (origin `https://example.org`):

```
curl -s -i -X OPTIONS '<endpoint>' -H 'Origin: https://example.org' \
  -H 'Access-Control-Request-Method: POST' -H 'Access-Control-Request-Headers: <the headers a real client sends>'
curl -s -i -X POST '<endpoint>' -H 'Origin: https://example.org' -H 'Content-Type: application/json' \
  [-H '<auth header>: placeholder-not-a-key'] -d '<a minimal body>'
```

Requested headers: OpenAI `authorization,content-type`; Anthropic
`anthropic-dangerous-direct-browser-access,anthropic-version,content-type,x-api-key`; Google native
`content-type,x-goog-api-key`; Google's OpenAI-compatible endpoint `authorization,content-type`.

**Beyond the specified commands** (each named so you can judge it):

- **The placeholder in place of a key**, `placeholder-not-a-key`, as `Authorization: Bearer …`, `x-api-key: …` or
  `x-goog-api-key: …`. It is no key and belongs to no account. About 30 requests carried it (19 by curl, 12 from
  the two browsers); with preflights and keyless requests about 90 requests went out in total.
- **Two real browsers.** A `fetch()` from the page `https://example.org` in headless Chromium 156.0.8078.4
  (Playwright's `chromium_headless_shell-1248`, driven over the DevTools protocol) and headless Firefox 154.0.1
  (the installed app, driven over WebDriver BiDi), each with a throwaway profile inside `s5/`, **deleted
  afterwards** (checked: no profile folder and no browser process left). The installed Chrome and the owner's
  profiles were not touched. Safari was not tested.
- Firefox started with a fresh profile; telemetry, updates and remote settings were switched off by preferences,
  but a fresh start may still have contacted Mozilla's services.
- **Extra preflights** to learn how each provider treats further headers (`x-stainless-*`, which the OpenAI and
  Anthropic JavaScript clients add; `x-goog-api-client`; `anthropic-workspace-id`; `api-revision`; a made-up
  `x-test-header`), a preflight and a placeholder POST against `eu.api.openai.com`, and the same against Google's
  Interactions endpoint.
- My first Google calls named the old model `gemini-2.5-flash` in the path; I repeated them with
  `gemini-3.5-flash-lite` and got the same headers.
- **No call with a real key.** A `200` was therefore not seen at any of the three. That a success answer carries
  the same headers is supported by each provider's own documentation of browser use (sections 3.x), not by a test.

**What a browser needs:** an allowed origin on the preflight *and* on the actual answer, and every request header
among the allowed ones. An answer without `access-control-allow-origin` reaches the network but not the script.

### Browser test [tested]

Same result in Chromium 156 (19:41:02 UTC) and Firefox 154 (19:41:50 UTC):

| Request from `https://example.org` | Preflight | Actual request | What the script saw |
|---|---|---|---|
| OpenAI `/v1/chat/completions`, placeholder bearer | 200 | 401 | status 401 and `{"error":{"message":"Incorrect API key provided: …","type":"invalid_request_error","param":null,"code":"invalid_api_key"}}`; headers visible: `cf-ray, content-length, content-type` |
| OpenAI `/v1/responses`, placeholder bearer | 200 | 401 | status 401 and the same error; also `x-request-id` visible |
| Anthropic `/v1/messages` **with** `anthropic-dangerous-direct-browser-access: true` | 200 | 401 | status 401 and `{"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"},"request_id":"req_…"}`; all headers visible, among them `request-id`, `x-should-retry` |
| Anthropic `/v1/messages` **without** that header | (cached from the row above) | 401 | **`TypeError: Failed to fetch`** (Chromium: `MissingAllowOriginHeader`; Firefox: „(Grund: CORS-Kopfzeile 'Access-Control-Allow-Origin' fehlt). Statuscode: 401.“) |
| Google `…/models/gemini-2.5-flash:generateContent`, placeholder `x-goog-api-key` | 200 | 400 | status 400 and `{"error":{"code":400,"message":"API key not valid. Please pass a valid API key.","status":"INVALID_ARGUMENT","details":[…"reason":"API_KEY_INVALID"…]}}` |
| Google `/v1beta/openai/chat/completions`, placeholder bearer | 200 | 400 | status 400 and `[{"error":{"code":400,"message":"Please pass a valid API key","status":"INVALID_ARGUMENT"}}]` |

No deprecation issue was raised by Chromium for any of the three (none of them answers `access-control-allow-headers: *`).

## 3 The three providers

Cost per wall: 15,000 input and 1,500 output tokens (one themes call with 5,000 + 250, five assignment calls with
2,000 + 250 each). All prices in US dollars per million tokens, as read today.

### 3.1 OpenAI

**CORS: works from a browser.** [tested, 19:38 and 19:39 UTC] Header lines, trimmed to status and `access-control-*`:

```
OPTIONS https://api.openai.com/v1/chat/completions
HTTP/2 200
access-control-allow-origin: https://example.org
access-control-allow-headers: authorization,content-type
access-control-allow-methods: GET, OPTIONS, POST
access-control-max-age: 86400
access-control-expose-headers: CF-Ray

OPTIONS https://api.openai.com/v1/responses
HTTP/2 200
access-control-allow-origin: *
access-control-allow-headers: authorization,content-type
access-control-allow-methods: DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT
access-control-max-age: 600
access-control-expose-headers: X-Request-ID, Server-Timing-Total, X-OpenAI-Inference-Capacity-Reason

POST /v1/chat/completions, no key
HTTP/2 401
access-control-allow-origin: *
access-control-expose-headers: CF-Ray
{"error":{"message":"You didn't provide an API key. …","type":"invalid_request_error","param":null,"code":null}}

POST /v1/chat/completions, placeholder Authorization
HTTP/2 401
access-control-allow-origin: *
{"error":{"message":"Incorrect API key provided: placehol*********-key. …","type":"invalid_request_error","param":null,"code":"invalid_api_key"}}
```

- **The allowed-header list is an echo.** A preflight asking for `authorization,content-type` plus eight
  `x-stainless-*` headers plus `x-test-header` got all of them back. Any header passes.
- **Rate-limit headers are not readable by the page on `/v1/chat/completions`.** Only `CF-Ray` is exposed on the
  answers I could provoke, so a script cannot read `Retry-After` or `x-ratelimit-*` there. Whether a `429` exposes
  more is not tested.
- `https://eu.api.openai.com/v1/chat/completions` answers the same way: preflight `200` with the origin echoed,
  `401` with `access-control-allow-origin: *`. [tested, 19:48 UTC]
- **What the documentation says about browsers** [read]: „Remember that your API key is a secret. Don't share it
  with others or expose it in any client-side code such as browsers or apps.“
  (<https://developers.openai.com/api/reference/overview>). The official JavaScript client is disabled in
  browsers: „Web browsers: disabled by default to avoid exposing your secret API credentials. Enable browser
  support by explicitly setting `dangerouslyAllowBrowser` to `true`.“ So browser use is possible and tolerated,
  not recommended; the client is not needed, a plain `fetch` with two headers does it.

**API.** Base URL `https://api.openai.com/v1`. Two endpoints fit [read]:

- `POST /chat/completions`: today's request shape. `gpt-6-luna`, `gpt-6.1-terra` and `gpt-6.2-sol` all list
  „Chat Completions | `v1/chat/completions` | Supported“. Nothing is stored as application state (`store` defaults
  to `false`).
- `POST /responses`: OpenAI's recommended API („Reasoning models work better with the Responses API. While the Chat
  Completions API is still supported …“). It **stores each response for 30 days by default**; `store: false`
  switches that off. Different body (`input`, `text.format`, `max_output_tokens`, `reasoning.effort`).
- For stage 4b, Chat Completions is the smaller change and keeps no state. [inferred]

**JSON by schema** [read], <https://developers.openai.com/api/docs/guides/structured-outputs>:

- Chat Completions: `response_format: { type: "json_schema", json_schema: { name, strict: true, schema } }`, exactly
  today's form. `name` „Must be a-z, A-Z, 0-9, or contain underscores and dashes, with a maximum length of 64.“
- Responses API: `text: { format: { type: "json_schema", name, strict: true, schema } }`.
- **Both schemas pass the documented subset as they stand:**
  - „**Supported `array` properties:** `minItems` — The array must have at least this many items. `maxItems` — The
    array must have at most this many items.“ (not for fine-tuned models, which do not concern us)
  - „To use Structured Outputs, all fields or function parameters must be specified as `required`.“ Both do.
  - „`additionalProperties: false` must always be set in objects“. Both do.
  - Supported types include „String … Object, Array, Enum, anyOf“.
  - Limits: „A schema may have up to 5000 object properties total, with up to 10 levels of nesting.“ „A schema may
    have up to 1000 enum values across all enum properties.“ The assignment schema has 50 properties and 300 enum
    values.
  - Nothing restricts property names; names that are digits are not mentioned. [inferred: allowed]
  - „When using Structured Outputs, outputs will be produced in the same order as the ordering of keys in the schema.“
- „the first request you make with any schema will have additional latency as our API processes the schema“. The
  second request beside a slow one (after 12 and 15 seconds) may fire on the very first run for that reason. [inferred]
- An answer can still miss the schema: a refusal, or a cut at the token limit.

**Parameters** [read unless marked]

| Parameter | `gpt-6-luna`, `gpt-6.1-terra` | `gpt-6.2-sol` |
|---|---|---|
| `reasoning_effort` | `none`, `low`, `medium` (default), `high`, `xhigh`, `max` | „The API rejects requests that set reasoning effort to `none`.“ Lowest is `low`; default `medium` |
| `temperature` | „When reasoning effort is not `none`, remove `temperature`, `top_p`, and `top_logprobs`.“ With `none` it is accepted [inferred from that sentence] | „omit `temperature`, `top_p`, `logprobs`, and `top_logprobs`“ |
| `seed` | in the reference, „This feature is in Beta. … Determinism is not guaranteed“. No page says a GPT-6 model refuses it; not tested | same |
| `max_tokens` | „now deprecated in favor of `max_completion_tokens`, and is not compatible with o-series models“. Use `max_completion_tokens`: „An upper bound for the number of tokens that can be generated for a completion, including visible output tokens and reasoning tokens.“ Whether GPT-6 models refuse `max_tokens` outright: [memory] earlier reasoning models did; not tested | same |

- Reasoning tokens „are billed as output tokens“ and can use up the limit before any visible output:
  „OpenAI recommends reserving at least 25,000 tokens for reasoning and outputs when you start experimenting with
  these models.“ With `reasoning_effort: "none"` this does not arise.

**Models** (ids and prices from the model pages and the pricing page) [read]

| Model id | What it is | In / out per 1M | Reasoning | Per wall |
|---|---|---|---|---|
| `gpt-6-luna` | „Our most efficient model for focused, high-volume tasks.“ 1.05M context | $0.10 / $0.50 | default `medium`, `none` allowed | **0.23 ct** with `none` |
| `gpt-6.1-terra` | „A fast, efficient model for visual reasoning, precise computer use, and clear, natural writing.“ | $1 / $5 | default `medium`, `none` allowed | 2.3 ct with `none` |
| `gpt-6.2-sol` | „Our go-to model for everyday work“; the guide: „For most API workflows, start with **GPT-6.2 Sol** at medium reasoning effort.“ | $2 / $10 | cannot be `none` | **4.5 ct** plus reasoning; 6.0 ct with 1,500 reasoning tokens, 10.5 ct with 6,000 |
| `gpt-6.2-astra` | flagship | $8 / $40 | – | not a candidate |

- Cheapest plausible: `gpt-6-luna`. Default mid-tier: `gpt-6.2-sol`.
- „Regional processing adds a 10% premium where available.“ On the EU endpoint `gpt-6-luna` costs 0.25 ct per wall.
- Older, cheaper ids are still on the price list (`gpt-5-nano` $0.05 / $0.40, `gpt-5.4-nano` $0.20 / $1.25); I did
  not check their state.

**Data** [read]

- **Training.** „Your data is your data. As of March 1, 2023, data sent to the OpenAI API is not used to train or
  improve OpenAI models (unless you explicitly opt in to share data with us).“
  <https://developers.openai.com/api/docs/guides/your-data>
- **Retention.** „By default, abuse monitoring logs are generated for all API feature usage and retained for up to
  30 days, unless longer retention is required by law, or is reasonably necessary to protect our services or any
  third party from harm.“ These logs „may contain certain customer content, such as prompts and responses“. For
  `/v1/chat/completions` the table says: training No, abuse monitoring 30 days, application state none.
- **Zero data retention.** „Currently, these controls are subject to prior approval by OpenAI and acceptance of
  additional requirements.“ Not a setting a facilitator can switch on.
- **Location.** Default projects are „Global“; nothing on the pages promises a place for them. „Data residency is
  a project configuration option“, „Eligible organizations can enable data residency when creating a project“,
  „**Contact sales** to discuss your data residency needs and become eligible.“ Europe („EEA + Switzerland“) has
  regional storage and regional processing at `eu.api.openai.com`; „Data residency endpoints are charged a 10%
  uplift“. „The project's residency region can't be changed after creation.“ System data, „structured output
  schema“ included, is outside the promise. <https://developers.openai.com/api/docs/guides/data-residency>
- So the honest default is „no location promised“. A facilitator with an EU project would need the product to
  call `eu.api.openai.com` instead; that is a second entry or a switch. [inferred]

**Access** [read unless marked]

- **Key:** <https://platform.openai.com/api-keys> → create a key; the quickstart says to create it „in the
  dashboard“. Keys belong to a project. Prefix: not stated on the pages read; `sk-proj-…` for project keys is
  [memory], and a search summary found it only in examples.
- **Payment:** prepaid. „New API accounts use prepaid billing.“ „The minimum purchase is $5, and the default amount
  is $10.“ Auto-reload „is turned on by default during setup“. „Purchased credits expire after one year.“
  <https://help.openai.com/en/articles/8264644-how-can-i-set-up-prepaid-billing>
- **Free tier:** the tier table has a „Free“ row, but the rate-limit tables of `gpt-6-luna` and `gpt-6.2-sol` start
  at „Build“. So a key without $5 of credit probably cannot call them. [inferred]
- **Spend limit:** yes, per project and per organisation: „enforce a hard spend limit for your organization or an
  individual project“; „affected API requests return a `429` error with the `organization_spend_limit_exceeded` or
  `project_spend_limit_exceeded` code. Enforcement is not instantaneous“. A key in a project of its own with a
  hard limit comes to a limit per key.

**Rate limits of the lowest paid tier, „Build“** ($5 in total credit purchases, $500 a month) [read]

| Model | RPM | TPM |
|---|---|---|
| `gpt-6-luna` | 5,000 | 2,000,000 |
| `gpt-6.1-terra`, `gpt-6.2-sol` | 5,000 | 1,000,000 |

Six calls with 15,000 tokens are far below that. A sharp rise can still be refused (`429`, `slow_down`), which the
guide ties to traffic near a million tokens a minute.

**Error shapes** `{"error":{"message":…,"type":…,"param":…,"code":…}}`

| Case | Status | Body |
|---|---|---|
| wrong key | 401 | `type: "invalid_request_error"`, `code: "invalid_api_key"` [tested] |
| no key | 401 | `type: "invalid_request_error"`, `code: null` [tested] |
| no credit | 429 | `code: "credit_balance_exhausted"`; „The broader `error.type` can still be `insufficient_quota`.“ [read] |
| own spend limit | 429 | `code: "organization_spend_limit_exceeded"` or `"project_spend_limit_exceeded"` [read] |
| OpenAI's monthly limit | 429 | `code: "organization_usage_limit_exceeded"` [read] |
| rate limit | 429 | „Rate limit reached for requests“ [read]; `code: "rate_limit_exceeded"` [memory]. Too fast a rise: `type: "rate_limit_error"`, `code: "slow_down"` [read] |
| overload | 503 | `type: "service_unavailable_error"`, `code: "server_is_overloaded"` [read] |
| model not found | 404 [memory] | `code: "model_not_found"` [read: the guide names the code] |
| schema refused | 400 [memory] | `type: "invalid_request_error"`, `param` naming the response format [memory]; the guide only says „you will receive an error“ |
| wrong country | 403 | „Country, region, or territory not supported“ [read] |

Billing and quota errors share status 429 with rate limits: the product must read `error.code` to tell „wait“ from
„add credit“.

### 3.2 Anthropic

**CORS: works from a browser, if and only if the request carries `anthropic-dangerous-direct-browser-access`.**
[tested, 19:39 UTC]

```
OPTIONS https://api.anthropic.com/v1/messages
  Access-Control-Request-Headers: anthropic-dangerous-direct-browser-access,anthropic-version,content-type,x-api-key
HTTP/2 200
access-control-allow-origin: *
access-control-allow-headers: anthropic-dangerous-direct-browser-access,anthropic-version,content-type,x-api-key
access-control-allow-methods: DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT
access-control-allow-credentials: true
access-control-max-age: 600

OPTIONS, the same without anthropic-dangerous-direct-browser-access
HTTP/2 400
access-control-allow-headers: anthropic-version,content-type,x-api-key
(no access-control-allow-origin)
Disallowed CORS origin

POST, placeholder x-api-key, with anthropic-dangerous-direct-browser-access: true
HTTP/2 401
access-control-allow-origin: *
access-control-expose-headers: *
{"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"},"request_id":"req_…"}

POST, placeholder x-api-key, without that header
HTTP/2 401
(no access-control-* header)
{"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"},"request_id":"req_…"}

POST, no key, with that header
HTTP/2 401
access-control-allow-origin: *
access-control-expose-headers: *
{"type":"error","error":{"type":"authentication_error","message":"x-api-key header is required"},"request_id":"req_…"}
```

- The header's presence decides, not its value: with `…: false` the `401` still carried
  `access-control-allow-origin: *`. [tested]
- The allowed-header list is an echo: `anthropic-beta`, `anthropic-workspace-id`, `authorization`, the
  `x-stainless-*` headers and `x-test-header` all came back. [tested]
- `access-control-expose-headers: *` lets the script read every response header, `retry-after` and the
  `anthropic-ratelimit-*` headers included. [tested for the headers present on a 401]
- `access-control-allow-credentials: true` next to `*` only matters for requests with cookies; both browsers
  accepted the answer.
- `Authorization: Bearer …` is read in place of `x-api-key` (`401 Invalid bearer token`). With
  `anthropic-version: 2023-06-01`, with `2026-10-21` and with no version header the answer was the same `401`: the
  key is checked first, so this shows nothing about the version. [tested]
- **What the documentation says** [read], <https://platform.claude.com/docs/en/manage-claude/authentication#browser-based-applications>:
  - „Call the Claude API from your own back end, not from code that runs in your users' browsers.“
  - „A request sent directly from a browser is a cross-origin (CORS) request. The API accepts these requests only
    when they include the `anthropic-dangerous-direct-browser-access: true` header, which the TypeScript SDK sends
    when you set `dangerouslyAllowBrowser` to `true`.“
  - „Organizations that have zero data retention (ZDR) or the Compliance API enabled cannot call the API directly
    from a browser, even with that header. Other organization settings can have the same effect, and no setting
    allows browser requests for these organizations. The API returns a 401 `authentication_error` whose message
    begins `CORS requests are not allowed for this Organization`, even though the API key is valid.“
  - „The restriction applies only to requests that include an `Origin` header“.
  - The SDK page names when browser use „might not be dangerous“: internal tools with trusted users, and
    development with short-lived keys. A facilitator's own key in their own browser is close to the first case.
- So this is the one provider of all seven that documents the browser path. The official client is not needed; a
  plain `fetch` with four headers does it.

**API.** `POST https://api.anthropic.com/v1/messages`, the native Messages API. [read]

- Headers: the key as `x-api-key: …` („legacy“) or `Authorization: Bearer …`; `anthropic-version`
  (`2023-06-01`, or `2026-10-21`, the version every example on the pages now uses); `content-type`; and
  `anthropic-dangerous-direct-browser-access: true`.
- **A key that is not bound to one workspace needs a fifth header:** „If your API key isn't scoped to a workspace,
  you must specify the workspace ID in the `anthropic-workspace-id` header for each request.“ The preflight
  allows it [tested]. The product should ask for a key scoped to one workspace, or it needs a second field.
- Body: `model`, `max_tokens` (required), `system` as a top-level field (not a message), `messages`,
  `output_config`, `thinking`. The answer's text is in `content[]`, in the block of type `text`; check
  `stop_reason` (`end_turn`, `max_tokens`, `refusal`) before parsing.
- An OpenAI-compatible endpoint exists; I did not look into it (the task names the Messages API). `inference_geo`
  „is also not available through“ it.

**JSON by schema** [read], <https://platform.claude.com/docs/en/build-with-claude/structured-outputs>

The raw JSON-schema form, as in the page's curl example:

```json
"output_config": {
  "format": {
    "type": "json_schema",
    "schema": {
      "type": "object",
      "properties": {
        "name": {"type": "string"},
        "email": {"type": "string"},
        "plan_interest": {"type": "string"},
        "demo_requested": {"type": "boolean"}
      },
      "required": ["name", "email", "plan_interest", "demo_requested"],
      "additionalProperties": false
    }
  }
}
```

There is no `name` and no `strict` in this form. „The `output_format` parameter has moved to `output_config.format`,
and beta headers are no longer required.“ „Structured outputs are available on every model“.

Supported, quoted: „All basic types: object, array, string, integer, number, boolean, null“; „`enum` and `const`
(strings, numbers, booleans, or nulls only)“; „`anyOf` and `allOf`, except the uses listed under ‚Not supported'“;
„`$ref`, `$defs`, and `definitions`“; „`required` and `additionalProperties` (must be set to `false` for objects)“;
„Array `minItems` (only values 0 and 1 supported)“.

**Not supported**, quoted in full:

- „Recursive schemas“
- „`oneOf` (use `anyOf` instead)“
- „`not`“
- „`anyOf` in the same schema object as keywords such as `type` or `properties` (annotations such as `title` and
  `description` are fine)“
- „`allOf` with schemas that conflict (for example, different `type` values)“
- „`allOf` with two or more schemas when one of them directly contains `$ref`, `anyOf`, or `allOf`“
- „Complex types within enums“
- „External `$ref` (for example, `'$ref': 'http://...'`)“
- „Numerical constraints (such as `minimum`, `maximum`, `multipleOf`)“
- „String constraints (`minLength`, `maxLength`)“
- „Array constraints beyond `minItems` of 0 or 1“
- „`additionalProperties` set to anything other than `false`“

„If you use an unsupported feature, you'll receive a 400 error with details.“

Against the two schemas:

- **Themes: refused as it stands.** `minItems: 3` and `maxItems: 6` are array constraints beyond `minItems` of 0 or
  1. For Anthropic send the schema without both, or with `minItems: 1`. The count then rests on the prompt and on
  the product's check. (Anthropic's own clients do the same: they strip such constraints, write them into the
  description and validate afterwards.)
- **Assignment: passes the documented rules.** `enum` on strings is supported; all fifty properties are
  `required`, so none counts against „Optional parameters | 24“; no union types („16“). Nothing restricts property
  names. What is not documented is the size of the compiled grammar: „there are additional internal limits on the
  compiled grammar size“, answered with „400 … ‚Schema is too complex for compilation.'“ Fifty enums of six
  letters are a small schema, but only a call with a key shows it. [inferred]
- „Structured outputs don't guarantee the capitalization of string `enum` and `const` values“, typically after a
  space. Single letters are not at risk; compare case-insensitively anyway.
- Property order: „required properties appear first, followed by optional properties“, in schema order.
- „The first time you use a specific schema, there is additional latency while the grammar compiles.“ „Compiled
  grammars are cached for 24 hours from last use“.
- „Claude automatically receives an additional system prompt explaining the expected output format“: input tokens
  are slightly higher than the prompt alone.

**Parameters** [read]

- **`temperature`:** „On … Claude Opus 5.5, … Claude Sonnet 5.5, … and Claude Haiku 5.5, non-default `temperature`,
  `top_p`, or `top_k` values return a 400 error on every request, regardless of whether thinking is used.“ And:
  „Starting with API version `2026-10-21`, a request that includes `temperature`, `top_p`, or `top_k` at any value
  returns a 400 error on every model.“ `temperature: 0` is non-default. **Remove it.**
- **`seed`:** not a parameter of the Messages API (its body parameters are `max_tokens`, `messages`, `model`,
  `cache_control`, `container`, `diagnostics`, `inference_geo`, `metadata`, `output_config`, `service_tier`,
  `speed`, `stop_sequences`, `stream`, `system`, `thinking`, `tool_choice`, `tools`). An unknown field is refused
  with 400 („Extra inputs are not permitted“ is the wording the errors page shows for another field). [inferred]
  **Remove it.**
- **`max_tokens`:** the name is right, and it is required. „Thinking tokens count toward your `max_tokens` limit“,
  „even when the thinking content isn't returned“.
- **Thinking and effort** (`output_config.effort`: `low`, `medium`, `high`, `xhigh`, `max`):

  | Model | Thinking by default | Switch off | Default effort |
  |---|---|---|---|
  | `claude-haiku-5-5` | adaptive, on | `thinking: { "type": "disabled" }`, accepted at effort `high` or below | `medium` |
  | `claude-sonnet-5-5` | adaptive, on | `disabled` is a 400; `thinking: { "type": "between_tools" }` „turns off up-front thinking“ („The model does not think before responding.“), at effort `high` or below | `high` |
  | `claude-opus-5-5` | adaptive, always on | not possible: `"thinking.type.disabled" is not supported for this model` | `medium` |

  A thinking budget (`type: "enabled"`) is a 400 on all three. Where thinking stays on, lower the effort and raise
  `max_tokens`.
- A request can end with HTTP 200 and `stop_reason: "refusal"`; the output then need not match the schema.

**Models** [read], <https://platform.claude.com/docs/en/about-claude/models/overview>,
<https://platform.claude.com/docs/en/about-claude/pricing>

| Model id | What it is | In / out per 1M | Per wall |
|---|---|---|---|
| `claude-haiku-5-5` | „For high-volume, latency-sensitive tasks such as classification, extraction, and routing“; released 2026-10-07 | $0.10 / $0.50 for prompts up to 100,000 tokens ($0.50 / $2.50 above) | **0.23 ct** with thinking disabled |
| `claude-sonnet-5-5` | „The best combination of speed and intelligence“ | $2 / $10 | **4.5 ct** with `between_tools`; with adaptive thinking 6.0 ct at 1,500 thinking tokens, 10.5 ct at 6,000 |
| `claude-opus-5-5` | „For long-running agentic coding and knowledge work“; „If you're unsure which model to use, start with Claude Opus 5.5“ | $4 / $20 | 9.0 ct plus thinking; **12 ct** at 1,500 thinking tokens, 21 ct at 6,000 |

- Cheapest plausible: `claude-haiku-5-5`. The mid tier is `claude-sonnet-5-5`; the model Anthropic names as the
  starting point is `claude-opus-5-5`. For sorting short notes neither is needed. [inferred]
- **Your cached facts against today's pages: no difference.** Ids `claude-haiku-5-5`, `claude-sonnet-5-5`,
  `claude-opus-5-5`; $0.10 / $0.50 „for prompts up to 100,000 tokens“, $2 / $10, $4 / $20; non-default
  `temperature` refused; thinking cannot be disabled on `claude-opus-5-5` and is on by default on the other two.
  Two things your note did not have: on `claude-sonnet-5-5` `disabled` is refused too (`between_tools` replaces
  it), and API version `2026-10-21` refuses `temperature` at any value on every model.
- **Token counts may be higher than the 15,000 assumed.** „Claude 4.7 and later models … use a newer tokenizer …
  This tokenizer produces approximately 30% more tokens for the same text“ (than Anthropic's earlier one). How it
  compares with the tokenizer behind the task's figures is not known; at +30 % a wall on Haiku costs 0.29 ct.
- `inference_geo: "us"` multiplies all prices by 1.1.

**Data** [read]

- **Training.** „By default, we will not use your inputs or outputs from our commercial products (e.g. Claude for
  Work, Anthropic API, Claude Gov, etc.) to train our models.“
  <https://privacy.claude.com/en/articles/7996868-is-my-data-used-for-model-training>
- **Retention.** „For Anthropic API users, we automatically delete inputs and outputs on our backend within 30 days
  of receipt or generation, except: When you use a service with longer retention under your control …, When you
  and we have agreed otherwise (e.g. zero data retention agreement), If we need to retain them for longer to
  enforce our Usage Policy (UP), In compliance with the law“. „We retain inputs and outputs for up to 2 years and
  trust and safety classification scores for up to 7 years if your chat is flagged by our automated trust and
  safety systems as violating our Usage Policy.“
  <https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data>
- The schema itself: „Only the JSON schema is cached, for up to 24 hours since last use.“
- **Zero data retention.** „To request ZDR for your organization, contact the Anthropic sales team.“ And:
  „Organizations with a ZDR arrangement cannot call the Claude API directly from a browser: the API rejects their
  cross-origin (CORS) requests.“ <https://platform.claude.com/docs/en/manage-claude/api-and-data-retention>
- **Location.** `inference_geo`: `"global"` is „Default. Inference may run in any available geography for optimal
  performance and availability.“; `"us"`: „Inference runs only in US-based infrastructure.“ „Only `"us"` and
  `"global"` are available.“ Storage at rest („workspace geo“): „Currently, `"us"` is the only available workspace
  geo.“ **No EU option.** <https://platform.claude.com/docs/en/manage-claude/data-residency>

**Access** [read]

- **Key:** <https://platform.claude.com/settings/keys> → „Create key“, with a name, an expiration („a preset (3
  hours, 1 day, 7 days, or 30 days), a custom duration, or **Never**“), a linked account and optionally one
  workspace. „The Console shows the full key, which starts with `sk-ant-`, only once, at creation.“ The docs'
  example: `sk-ant-api03-...`.
- **Payment:** prepaid. „Claude API and playground usage is billed through prepaid usage credits. Buy credits
  before you use the API“. „If you run out of credits, you can no longer call the API“. „Credits expire one year
  from the purchase date“. „New users receive free credits to test the API.“ Claude Max, Ultra and Team plans
  include monthly API credits.
  <https://support.claude.com/en/articles/8977456-how-do-i-pay-for-my-claude-api-usage>
- **Spend limit:** per organisation and per workspace, not per key: „you can set custom spend and rate limits for
  each workspace“. A key scoped to a workspace of its own with a limit comes to a limit per key, and also removes
  the fifth header.

**Rate limits** [read], <https://platform.claude.com/docs/en/api/rate-limits>

| Lowest standard tier, „Start“ ($500 a month cap) | RPM | Input TPM | Output TPM |
|---|---|---|---|
| Claude Haiku 5.5, Claude Sonnet 5.5, Claude Opus 5.5 (each) | 4,000 | 2,000,000 | 400,000 |

- Six calls are far below that. Two caveats: „New organizations and organizations with limited usage history may
  start in the Evaluation tier, with limits below the standard limits shown on this page“ (numbers not
  published), and a ramp limit: „A burst of requests within a few seconds can also count as a sharp increase.“
  Whether six calls at once trip either for a brand-new account is not known.
- „a rate of 60 requests per minute (RPM) might be enforced as 1 request per second“.

**Error shapes** `{"type":"error","error":{"type":…,"message":…},"request_id":"req_…"}`

| Case | Status | Body |
|---|---|---|
| wrong key | 401 | `authentication_error`, „invalid x-api-key“ (bearer: „Invalid bearer token“) [tested] |
| no key | 401 | `authentication_error`, „x-api-key header is required“ [tested] |
| organisation may not call from a browser | 401 | `authentication_error`, message begins „CORS requests are not allowed for this Organization“ [read] |
| no credit | 402 | `billing_error` [read]. [memory] says a `400 invalid_request_error` „Your credit balance is too low …“ also existed; which one comes today is not tested |
| own spend limit reached | 400 | `invalid_request_error`, message starts „You have reached your specified API usage limits“ [read] |
| tier's monthly cap | 429 | `rate_limit_error` with `"details": { "error_code": "enforced_spend_limit_reached" }`, no `retry-after` [read] |
| rate limit | 429 | `rate_limit_error`, usually with `retry-after`; ramp limit: `details.error_code: "ramp_limit_exceeded"` [read] |
| overload | 529 | `overloaded_error` [read] |
| model not found | 404 | `not_found_error` [read]; message `model: <id>` [memory] |
| schema refused | 400 | `invalid_request_error` „with details“; too large: „Schema is too complex for compilation.“ [read] |
| `temperature` sent | 400 | `invalid_request_error` [read] |

### 3.3 Google Gemini (AI Studio key)

**CORS: works from a browser, with a fixed set of headers.** [tested, 19:39, 19:40 and 19:54 UTC]

```
OPTIONS https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent
  Access-Control-Request-Headers: content-type,x-goog-api-key
HTTP/2 200
access-control-allow-origin: https://example.org
access-control-allow-methods: DELETE,GET,HEAD,OPTIONS,PATCH,POST,PUT
access-control-allow-headers: content-type,x-goog-api-key
access-control-max-age: 3600

POST, no key
HTTP/2 403
access-control-allow-origin: https://example.org
access-control-expose-headers: vary,vary,vary,content-encoding,date,server,content-length
{"error":{"code":403,"message":"Permission denied on the service.","status":"PERMISSION_DENIED","details":[…"reason":"ACCESS_DENIED"…]}}

POST, placeholder x-goog-api-key
HTTP/2 400
access-control-allow-origin: https://example.org
{"error":{"code":400,"message":"API key not valid. Please pass a valid API key.","status":"INVALID_ARGUMENT","details":[…"reason":"API_KEY_INVALID"…]}}

OPTIONS https://generativelanguage.googleapis.com/v1beta/openai/chat/completions
  Access-Control-Request-Headers: authorization,content-type
HTTP/2 200
access-control-allow-origin: https://example.org
access-control-allow-headers: authorization,content-type
access-control-max-age: 3600

POST there, placeholder Authorization
HTTP/2 400
access-control-allow-origin: https://example.org
[{"error":{"code":400,"message":"Please pass a valid API key","status":"INVALID_ARGUMENT"}}]
```

- **The preflight checks the requested headers against a list and answers `403` with no `access-control-*`
  header to anything else.** Passed: `content-type`, `x-goog-api-key`, `x-goog-api-client`, `authorization`.
  Refused: `x-test-header`, `api-revision`, and each of the eight `x-stainless-*` headers singly. So:
  - a plain `fetch` with `content-type` and `x-goog-api-key` works;
  - **OpenAI's JavaScript client pointed at Google's OpenAI-compatible endpoint fails in a browser** (it adds
    `x-stainless-*`), a plain `fetch` to that endpoint works;
  - **the `Api-Revision: 2026-05-20` header of every Interactions API example cannot be sent from a browser.**
- The key in the query (`?key=…`) gets the same answers; the header is the better place (no key in URLs or logs).
- `/v1` in place of `/v1beta` answers the preflight the same way.
- Only `vary, content-encoding, date, server, content-length` are exposed: a script cannot read `retry-after`.
- **What the documentation says** [read]: „**Never expose keys client-side in production**: Do not hardcode API
  keys directly in web or mobile apps. … To secure client-side apps, run a backend proxy server“
  (<https://ai.google.dev/gemini-api/docs/api-key>). Google's JavaScript client lists „Browser | Supported, with
  an API key“ and warns „Avoid exposing API keys in client-side code.“ As with the other two: possible, not
  recommended for shipped keys, and a facilitator's own key is not a shipped key.

**API.** Three surfaces on `https://generativelanguage.googleapis.com` [read]:

| Surface | Path | For stage 4b |
|---|---|---|
| `generateContent` | `POST /v1beta/models/{model}:generateContent` | **the one to use.** „While it is now considered legacy, the original `generateContent` API remains fully supported.“ Stateless |
| Interactions API | `POST /v1beta/interactions` | „Generally Available and the recommended interface for all new projects“ since June 2026. **Stores requests by default** (55 days on the paid tier) unless `store: false`; documented with the `Api-Revision` header the preflight refuses. Whether it behaves the same without that header is not tested |
| OpenAI-compatible | `POST /v1beta/openai/chat/completions` | keeps today's request shape, but „Support for the OpenAI libraries is still in beta“, its key errors are a JSON **array**, and Google says: „If you aren't already using the OpenAI libraries, we recommend that you call the Gemini API directly.“ |

**JSON by schema** [read], <https://ai.google.dev/gemini-api/docs/structured-output?generate-content=true>

- `generateContent`, as today's REST example has it:

  ```json
  "generationConfig": {
    "responseFormat": {
      "text": {
        "mimeType": "APPLICATION_JSON",
        "schema": { "type": "object", "properties": { … }, "required": [ … ] }
      }
    }
  }
  ```

  The page's text also names `response_json_schema` for the clients. The migration guide still shows the older
  `generationConfig: { "responseMimeType": "application/json", "responseSchema": { "type": "OBJECT", … } }`.
  Which of the two a given model accepts, and whether both still work, needs one call with a key.
- Interactions API: `"response_format": { "type": "text", "mime_type": "application/json", "schema": { … } }`.
- OpenAI-compatible endpoint: `response_format` as today; the page shows it through the client's helpers only.
- **Both schemas pass the documented subset as they stand:**
  - arrays: „**`minItems`**: The minimum number of items in the array. **`maxItems`**: The maximum number of items
    in the array.“ and „`minItems` and `maxItems` are enforced.“
  - strings: „**`enum`**: Lists a specific set of possible strings for classification tasks.“
  - objects: `properties`, `required`, and „**`additionalProperties`**: … Can be a boolean or a schema.“
  - Nothing restricts property names. [inferred: digits allowed]
  - „the model will produce outputs in the same order as the keys in the schema“.
- **The limit that is not a number:** „Very large or deeply nested schemas may be rejected.“ The schema becomes
  „a state machine“ with „limits on total states, branching paths, and nesting depth“; over them, „`400
  INVALID_ARGUMENT`“. „Optional properties, `enum` values, and `anyOf` branches multiply the branching paths“,
  „Property keys consume states proportional to their character length“, „Array bounds such as `minItems` and
  `maxItems` duplicate the item schema for each counted position“. Fifty required one- or two-character keys with
  six one-letter values are the friendly case, but only a call with a key shows it. [inferred]
- Structured outputs are listed as supported for Gemini 4 Hydrogen, Gemini 3.5 Flash-Lite, Gemini 3.1 Flash-Lite
  and Gemini 2.5 Flash-Lite, among others.

**Parameters** [read]

- **`temperature`:** on Gemini 3.5 Flash-Lite, 3.6 Flash and later: „`temperature`, `top_p`, and `top_k` are
  deprecated and ignored. In future model generations, supplying these parameters returns an HTTP 400 error.
  **Remove these parameters from all requests.**“ On Gemini 4 Hydrogen: „The server ignores in-range custom values
  if sent. Out-of-range values return a `400` validation error.“ **Remove it.**
- **`seed`:** not mentioned on any page read today. [memory] `generationConfig.seed` existed; whether current
  models honour or refuse it is not checked. Leave it out.
- **Output limit:** `generationConfig.maxOutputTokens` (OpenAI-compatible endpoint: `max_tokens`). It „sets the
  maximum number of tokens a response can generate, including thought tokens.“ „If the model hits this limit while
  reasoning, it stops generating with status `"incomplete"` and returns truncated or empty output (while still
  billing for any thinking tokens generated). To reduce cost or latency without truncating responses, lower
  `thinking_level` … instead of setting a small `max_output_tokens`.“
- **Thinking:** `generationConfig.thinkingConfig.thinkingLevel` (OpenAI-compatible endpoint: `reasoning_effort`).

  | Model | Default | Levels |
  |---|---|---|
  | `gemini-3.5-flash-lite` | on, `minimal` („Near-off thinking, lowest latency“) | `minimal`, `low`, `medium`, `high` |
  | `gemini-3.1-flash-lite` | on, `minimal` | `minimal`, `low`, `medium`, `high` |
  | `gemini-4-hydrogen` | on, `high` | `low`, `medium`, `high`, `xhigh`; „rejects `minimal` with an error“ |
  | `gemini-2.5-flash-lite` | off | `thinkingBudget`, not levels |

  „Reasoning cannot be turned off for Gemini 2.5 Pro, Gemini 3, or Gemini 4 models.“ „When thinking is turned on,
  response pricing is the sum of output tokens and thinking tokens.“
- System prompt: a top-level `system_instruction: { "parts": [ { "text": … } ] }`, not a message.
- A model turn at the end of the messages (prefill) is to be removed for these models too.

**Models** [read], <https://ai.google.dev/gemini-api/docs/choosing-a-model>, <https://ai.google.dev/gemini-api/docs/pricing>

| Model id | What it is | In / out per 1M (paid tier; output includes thinking) | Per wall |
|---|---|---|---|
| `gemini-3.5-flash-lite` | „Our fastest, lowest-cost general model for high-volume tasks. Choose it for translation, summarization, and structured JSON extraction at scale“; released 2026-07-21, no shutdown date | $0.30 / $2.50 | **0.83 ct** plus thinking at `minimal`; 1.2 ct with 1,500 thinking tokens |
| `gemini-3.1-flash-lite` | previous Flash-Lite; **shutdown not before 2027-05-07** | $0.25 / $1.50 | 0.60 ct plus thinking |
| `gemini-2.5-flash-lite` | older generation, thinking off by default; „not deprecated and remains available through the API until further notice“ | $0.10 / $0.40 | 0.21 ct |
| `gemini-4-hydrogen` | „Fast and cost-efficient for everyday coding and agentic workflows“; free and paid tier | $1.50 / $7.50 | **3.4 ct** plus thinking; 4.5 ct with 1,500 thinking tokens, 7.9 ct with 6,000 |
| `gemini-3.8-flash` | „previous-generation Flash model“ | $0.75 / $3.75 „through December 31, 2026“ | 1.7 ct plus thinking |
| `gemini-4-neon`, `gemini-4-carbon` | larger; paid tier only | $3 / $15; $2 / $10 until 2026-11-30, then $4 / $20 | not candidates |

- Cheapest plausible among the current models: `gemini-3.5-flash-lite`. Default mid-tier: `gemini-4-hydrogen`.
- `gemini-2.5-flash-lite` is the cheapest id that still answers, a third of the price, two generations old.
- **Gemma 4 is on this API too**, free tier only („Input price | Free of charge | Not available“). It is the
  family of the reference model measured at Cloudflare. With no paid tier, its content falls under the free-tier
  data terms below. I did not read which Gemma 4 sizes are served.

**Data** [read], <https://ai.google.dev/gemini-api/docs/terms> („Effective March 23, 2026“)

- **Paid key** (a project with an active billing account): „Google doesn't use your prompts … or responses to
  improve our products, and will process your prompts and responses in accordance with the Data Processing
  Addendum for Products Where Google is a Data Processor.“
- **Free key:** „Google uses the content you submit to the Services and any generated responses to provide,
  improve, and develop Google products and services and machine learning technologies“; „human reviewers may read,
  annotate, and process your API input and output“; „**Do not submit sensitive, confidential, or personal
  information to the Unpaid Services.**“
- **But for Europe:** „If you're in the European Economic Area, Switzerland, or the United Kingdom, the terms under
  ‚How Google uses Your Data' in ‚Paid Services' apply to all Services, including Google AI Studio and unpaid quota
  in the Gemini API, even though they are offered free of charge.“
- **Retention.** „Google retains the following data for fifty-five (55) days for the purposes of detecting and
  preventing violations of the Prohibited Use Policy …: Prompts … Contextual Information … Output“.
  <https://ai.google.dev/gemini-api/docs/usage-policies>
- **A second store, for the key's owner:** „Logging is on by default for Interactions API calls, and for Generate
  Content API calls in projects created on or after October 26, 2026.“ „Logs are retained for a default maximum
  period of 55 days“, settable to 7, 14, 28 or 55 days, and can be switched off in AI Studio. These logs are
  „private to your Google Cloud project“ and not used by Google unless the owner shares them.
  <https://ai.google.dev/gemini-api/docs/logs-policy>
- **Location.** „This data may be stored transiently or cached in any country in which Google or its agents
  maintain facilities.“ No region can be chosen with an AI Studio key.
- **Zero data retention.** „If your workload requires guaranteed zero data retention or enterprise data processing
  agreements, use Vertex AI.“ <https://ai.google.dev/gemini-api/docs/zdr>
- **Two sentences of the terms that touch the product itself**, not only the facilitator: „Use of Google AI Studio
  and Gemini API is for developers building with Google AI models for professional or business purposes, not for
  consumer use.“ and „**You may use only Paid Services when making API Clients available to users in the European
  Economic Area, Switzerland, or the United Kingdom.**“ Whether a wall that calls with the facilitator's own key
  is such an „API Client“ is a question for a person, not for this research.

**Access** [read unless marked]

- **Key:** <https://aistudio.google.com/api-keys> → „Create API key“. For a new user „Google AI Studio
  automatically creates a default Google Cloud project and API key after you accept the Terms of Service.“
- **Two key types.** Since 2026-05-28 „all new API keys created in Google AI Studio are automatically created as
  auth keys“, bound to a service account and „restricted to the Generative Language API (Gemini API) by default“.
  Older „standard“ keys work only when restricted: „The Gemini API rejects requests from **unrestricted standard
  keys**.“ The format of either is not stated on the pages; standard keys beginning `AIza`, 39 characters, is
  [memory]; the auth keys' format I do not know. **Do not validate the key's shape in the product.**
- A key restricted to IP addresses or to other websites („Application restrictions“) will be refused from the
  wall's origin. [inferred]
- **Payment:** the free tier needs none. The paid tier means „linking a billing account and prepaying to add a
  minimum of $5“; „New users default to the Prepay billing plan.“ At a zero balance „Requests then fail with an
  HTTP 402 Payment Required error“ for every key of that billing account.
- **Spend limit:** per project, not per key, and „Experimental“: „You can set your own project-level spend caps in
  AI Studio“, with „overages for around a 10 minute latency period“. Above that a cap per tier (Tier 1: $250 a
  month).

**Rate limits** [read], <https://ai.google.dev/gemini-api/docs/rate-limits>

- „Rate limits are applied per project, not per API key.“ Measured in requests per minute, input tokens per minute
  and requests per day.
- **The numbers for the text models are not on the page**; they are shown only in AI Studio to a signed-in user.
  So whether six calls side by side fit in Tier 1, or in the free tier, is **not known**.
- Tier 1 („Set up and link an active billing account“) also has a spend-based limit of $10 per 10 minutes; a wall
  costs under a cent.

**Error shapes: three on one host**

| Surface | Shape |
|---|---|
| `generateContent` | `{"error":{"code":400,"message":…,"status":"INVALID_ARGUMENT","details":[{"@type":…,"reason":"API_KEY_INVALID",…}]}}` [tested] |
| OpenAI-compatible, and key errors of the Interactions endpoint | the same object **inside a one-element array**: `[{"error":{…}}]` [tested] |
| Interactions API | `{"error":{"code":"invalid_request","message":…}}`, `code` a word [read] |

| Case (`generateContent`) | Status | Body |
|---|---|---|
| wrong key | **400**, not 401 | `status: "INVALID_ARGUMENT"`, `details[].reason: "API_KEY_INVALID"`, „API key not valid. Please pass a valid API key.“ [tested] |
| no key | 403 | `status: "PERMISSION_DENIED"`, „Permission denied on the service.“ [tested] |
| key blocked, project restricted, verification or billing needed | 403 | `PERMISSION_DENIED` [read, Interactions table: `permission_denied`] |
| no credit (prepaid balance at zero) | 402 | „HTTP 402 Payment Required“ [read]; Interactions: `payment_required` |
| rate limit, daily quota, spend-based limit | 429 | `RESOURCE_EXHAUSTED` [read]; Interactions: `rate_limit_exceeded`, `quota_exceeded`, `too_many_requests` |
| model not found | 404 | Interactions: `model_not_found` [read]; `generateContent`: `NOT_FOUND` [memory] |
| schema refused | 400 | `INVALID_ARGUMENT` [read] |
| overload | 503 | Interactions: `service_unavailable` [read] |

A wrong key and a refused schema share status 400 at Google: the product must read `details[].reason` or the
message to tell them apart.

## 4 What has to change in the requests

Today's request: `POST …/chat/completions` with `model`, `messages` (system + user), `temperature: 0`, `seed`,
`max_tokens`, `response_format: { type: "json_schema", json_schema: { name, strict: true, schema } }`.

**OpenAI** (the smallest change)

- URL `https://api.openai.com/v1/chat/completions`; headers `Authorization: Bearer <key>`, `Content-Type`.
- `model: "gpt-6-luna"`, and **add `reasoning_effort: "none"`** (the default is `medium`).
- **`max_tokens` → `max_completion_tokens`.**
- `temperature: 0` and `seed` can stay with `reasoning_effort: "none"` by the documentation; if a mid-tier model
  with reasoning is offered (`gpt-6.2-sol`: `reasoning_effort: "low"`), **drop `temperature`** and raise the
  output limit well above 250.
- `response_format` and both schemas unchanged. Answer in `choices[0].message.content`; a refusal arrives in
  `message.refusal`, a cut as `finish_reason: "length"`.

**Anthropic** (a different API)

- URL `https://api.anthropic.com/v1/messages`; headers `x-api-key: <key>`, `anthropic-version: 2023-06-01` (or
  `2026-10-21`), `content-type`, **`anthropic-dangerous-direct-browser-access: true`**.
- Body:
  ```json
  {
    "model": "claude-haiku-5-5",
    "max_tokens": 1000,
    "system": "<the system prompt>",
    "messages": [{ "role": "user", "content": "<the user prompt>" }],
    "thinking": { "type": "disabled" },
    "output_config": { "format": { "type": "json_schema", "schema": { … } } }
  }
  ```
  (`max_tokens: 1000` is my placeholder with headroom, not a measured value.)
- **Remove `temperature` and `seed`.** Move the system message to `system`. `max_tokens` keeps its name.
- **Themes schema: remove `minItems: 3` and `maxItems: 6`** (or set `minItems: 1`). Assignment schema unchanged.
  No `name`, no `strict`.
- For `claude-sonnet-5-5` send `"thinking": { "type": "between_tools" }` in place of `disabled`; for
  `claude-opus-5-5` send no `thinking`, set `"output_config": { "effort": "low", "format": … }` and a far higher
  `max_tokens`.
- Answer: the `text` of the block with `type: "text"` in `content[]`; `stop_reason` must be `end_turn`. Usage in
  `usage.input_tokens` and `usage.output_tokens`.

**Google** (a different API; the OpenAI-compatible endpoint is the alternative)

- URL `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent`; headers
  **only** `x-goog-api-key: <key>` and `Content-Type`.
- Body:
  ```json
  {
    "system_instruction": { "parts": [{ "text": "<the system prompt>" }] },
    "contents": [{ "role": "user", "parts": [{ "text": "<the user prompt>" }] }],
    "generationConfig": {
      "maxOutputTokens": 1000,
      "thinkingConfig": { "thinkingLevel": "minimal" },
      "responseFormat": { "text": { "mimeType": "APPLICATION_JSON", "schema": { … } } }
    }
  }
  ```
  Each field is from today's pages, but they are not shown together in one example; one call with a key should
  confirm the whole. (`maxOutputTokens: 1000` is my placeholder.)
- **Remove `temperature` and `seed`.** Both schemas unchanged.
- For `gemini-4-hydrogen` the lowest level is `low`; raise the limit accordingly.
- Answer: `candidates[0].content.parts[0].text` [read]; check `finishReason` [memory]. The `"role": "user"` in
  `contents` is [memory] too; the pages' examples leave it out.
- Alternative with today's shape: `POST /v1beta/openai/chat/completions` with `Authorization: Bearer <key>`,
  `reasoning_effort` in place of the thinking level, no `temperature`; plain `fetch` only, and its key error is an
  array.

**For all three**

- `connect-src` would need `https://api.openai.com` (and `https://eu.api.openai.com` if an EU entry is offered),
  `https://api.anthropic.com`, `https://generativelanguage.googleapis.com`.
- The first call with a new schema is slower at OpenAI and Anthropic (the schema is compiled, then cached). The
  second request beside a slow one may fire on a first run.
- Reasoning: decide per model whether it is off, and size the output limit from that. 250 fits only where it is off.
- Reading the wait time after a 429 from a header works at Anthropic only; at OpenAI and Google the header is not
  exposed to the page.
- Four more error shapes join the three of the EU providers, and at OpenAI and Google the status alone does not
  say whether the key, the credit or the request is wrong.
- Keys: OpenAI and Google keys are bound to a project; an Anthropic key may be bound to a workspace, and if it is
  not, the request needs the workspace id.

## 5 The facts for the line at the button

| Provider | Goes to | Processed in | Kept | Training | Sentence it supports |
|---|---|---|---|---|---|
| OpenAI | OpenAI | no place promised (worldwide); EU only with an EU project of the key's owner | up to 30 days | no | „Die Zettel gehen an OpenAI, ohne festen Ort, dort bis zu 30 Tage gespeichert, nicht zum Training genutzt.“ |
| Anthropic | Anthropic | „any available geography“; the only choice is US-only | up to 30 days (2 years if flagged) | no | „Die Zettel gehen an Anthropic, ohne festen Ort, dort bis zu 30 Tage gespeichert, nicht zum Training genutzt.“ |
| Google, paid key | Google | no place promised („any country in which Google or its agents maintain facilities“) | 55 days | no | „Die Zettel gehen an Google, ohne festen Ort, dort 55 Tage gespeichert, nicht zum Training genutzt.“ |
| Google, free key | Google | as above | 55 days | **yes**, and reviewers may read it; not for users in the EEA, Switzerland, UK | the product cannot see which kind of key it holds; the line has to name the condition or the worse case |

The German sentences are drafts for the owner; only the facts in the columns are researched. Flagged content is
kept longer at all three.

## 6 Not verified

- **A successful answer.** No call with a real key at any of the three. That a `200` carries
  `access-control-allow-origin` rests on the error answers and on each provider's documentation of browser use.
  Likewise `429`, `400` for a refused schema and `404` for a wrong model were not provoked; their shapes are from
  the pages or from memory, as marked.
- **OpenAI:** whether `gpt-6-luna` accepts `temperature: 0` and `seed` with `reasoning_effort: "none"`, and
  whether it refuses `max_tokens`; the key prefix; whether a free-tier account can call the model; whether a `429`
  exposes `Retry-After` to the page; property names that are digits; the state of the older nano models.
- **Anthropic:** whether the assignment schema stays under the internal grammar limit; what an unknown field such
  as `seed` returns; the error on an empty credit balance (402 by the docs); the limits of the „Evaluation tier“
  and whether six calls at once trip a ramp limit on a new account; how Claude's token count compares with the
  15,000 assumed.
- **Google:** the rate limits of Tier 1 and of the free tier for the text models (shown only in AI Studio); which
  of the two `generateContent` forms for the schema current models accept, and the request of section 4 as a
  whole; whether the assignment schema stays under the state limits; whether `seed` is accepted; the format of
  the new auth keys and whether they behave like standard keys in the `x-goog-api-key` header; the Interactions
  API without `Api-Revision`; which Gemma 4 sizes are served; the `finishReason` field of the answer.
- **Reasoning tokens.** The „about“ costs assume 250 reasoning tokens per call. No provider publishes a number, and
  none was measured.
- **Browsers:** Safari and all mobile browsers; the installed Chrome (tested was Chromium 156 headless).
- **Quality:** no model of the three is measured on the corpus. „Plausibly good enough“ is my reading of each
  provider's own description (classification, extraction, routing), nothing more.
- **Contracts and law:** no data processing agreement was opened; Google's sentences on „professional or business
  purposes“ and on Paid Services for EEA users are quoted, not assessed.

## 7 Sources (all read or called on 2026-11-23)

**OpenAI** (docs read as Markdown from `developers.openai.com`, by appending `.md`)

- API overview, authentication: <https://developers.openai.com/api/reference/overview>
- Structured outputs: <https://developers.openai.com/api/docs/guides/structured-outputs>
- Chat Completions reference: <https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create>
- Models: <https://developers.openai.com/api/docs/models>, <https://developers.openai.com/api/docs/models/gpt-6-luna>,
  <https://developers.openai.com/api/docs/models/gpt-6.2-sol>, <https://developers.openai.com/api/docs/models/gpt-6.1-terra>,
  <https://developers.openai.com/api/docs/guides/model-selection>
- Pricing: <https://developers.openai.com/api/docs/pricing>
- Reasoning, GPT-6 and GPT-6.2 guides: <https://developers.openai.com/api/docs/guides/reasoning>,
  <https://developers.openai.com/api/docs/guides/latest-model>, <https://developers.openai.com/api/docs/guides/latest-model/gpt-6-astra>,
  <https://developers.openai.com/api/docs/guides/token-counting>
- Data: <https://developers.openai.com/api/docs/guides/your-data>, <https://developers.openai.com/api/docs/guides/data-residency>
- Limits and errors: <https://developers.openai.com/api/docs/guides/rate-limits>, <https://developers.openai.com/api/docs/guides/spend-limits>,
  <https://developers.openai.com/api/docs/guides/error-codes>
- Keys: <https://developers.openai.com/api/docs/guides/api-keys>, <https://developers.openai.com/api/docs/guides/production-best-practices>,
  <https://developers.openai.com/api/docs/quickstart>
- Prepaid billing: <https://help.openai.com/en/articles/8264644-how-can-i-set-up-prepaid-billing>
- JavaScript client readme: <https://raw.githubusercontent.com/openai/openai-node/master/README.md>

**Anthropic** (docs read as Markdown from `platform.claude.com`, by appending `.md`)

- Authentication, browser-based applications: <https://platform.claude.com/docs/en/manage-claude/authentication>
- TypeScript SDK, browser usage: <https://platform.claude.com/docs/en/api/sdks/typescript>,
  <https://raw.githubusercontent.com/anthropics/anthropic-sdk-typescript/main/README.md>
- Structured outputs: <https://platform.claude.com/docs/en/build-with-claude/structured-outputs>
- Messages API reference, versions: <https://platform.claude.com/docs/en/api/messages/create>,
  <https://platform.claude.com/docs/en/api/versioning>
- Models and pricing: <https://platform.claude.com/docs/en/about-claude/models/overview>,
  <https://platform.claude.com/docs/en/about-claude/pricing>, <https://platform.claude.com/docs/en/models/haiku-5-5/overview>,
  <https://platform.claude.com/docs/en/models/haiku-5-5/migration-guide>, <https://platform.claude.com/docs/en/models/sonnet-5-5/overview>
- Thinking and effort: <https://platform.claude.com/docs/en/build-with-claude/thinking>,
  <https://platform.claude.com/docs/en/build-with-claude/effort>
- Data: <https://platform.claude.com/docs/en/manage-claude/api-and-data-retention>,
  <https://platform.claude.com/docs/en/manage-claude/data-residency>,
  <https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data>,
  <https://privacy.claude.com/en/articles/7996868-is-my-data-used-for-model-training>
- Limits and errors: <https://platform.claude.com/docs/en/api/rate-limits>, <https://platform.claude.com/docs/en/api/errors>
- Keys and billing: <https://platform.claude.com/docs/en/get-api-key>,
  <https://support.claude.com/en/articles/8977456-how-do-i-pay-for-my-claude-api-usage>

**Google** (docs read as Markdown from `ai.google.dev/gemini-api/docs/<page>.md.txt`; the `generateContent` variants
with `?generate-content=true`)

- Models and choice: <https://ai.google.dev/gemini-api/docs/models>, <https://ai.google.dev/gemini-api/docs/choosing-a-model>,
  <https://ai.google.dev/gemini-api/docs/models/gemini-4-hydrogen>, <https://ai.google.dev/gemini-api/docs/deprecations>
- Pricing: <https://ai.google.dev/gemini-api/docs/pricing>
- Structured outputs: <https://ai.google.dev/gemini-api/docs/structured-output>
- Thinking and parameter changes: <https://ai.google.dev/gemini-api/docs/thinking>,
  <https://ai.google.dev/gemini-api/docs/whats-new-gemini-4-hydrogen>, <https://ai.google.dev/gemini-api/docs/whats-new-gemini-3.6>,
  <https://ai.google.dev/gemini-api/docs/whats-new-gemini-3.8>
- The three surfaces: <https://ai.google.dev/gemini-api/docs/interactions>, <https://ai.google.dev/gemini-api/docs/interactions-overview>,
  <https://ai.google.dev/gemini-api/docs/migrate-to-interactions>, <https://ai.google.dev/gemini-api/docs/openai>,
  <https://ai.google.dev/gemini-api/docs/text-generation>
- Data: <https://ai.google.dev/gemini-api/docs/terms>, <https://ai.google.dev/gemini-api/docs/usage-policies>,
  <https://ai.google.dev/gemini-api/docs/logs-policy>, <https://ai.google.dev/gemini-api/docs/zdr>,
  <https://ai.google.dev/gemini-api/docs/available-regions>
- Keys, billing, limits, errors: <https://ai.google.dev/gemini-api/docs/api-key>, <https://ai.google.dev/gemini-api/docs/billing>,
  <https://ai.google.dev/gemini-api/docs/rate-limits>, <https://ai.google.dev/gemini-api/docs/api-errors>,
  <https://ai.google.dev/gemini-api/docs/troubleshooting>
- JavaScript client readme: <https://raw.githubusercontent.com/googleapis/js-genai/main/README.md>

**Not fetched or not found**

- <https://ai.google.dev/gemini-api/docs/abuse-monitoring.md.txt> answered 404; the same text is on `usage-policies`.
- OpenAI's help article on API key safety and Google's per-model rate-limit numbers (AI Studio, sign-in needed)
  were not read.
