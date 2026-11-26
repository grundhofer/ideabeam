# Vocabulary-trimmed MiniLM (q8): does the idea hold?

Throwaway measurement, 2026-11-22. Source model: `Xenova/paraphrase-multilingual-MiniLM-L12-v2`, `onnx/model_quantized.onnx`.

## Verdict

**Use with caveats.** The hypothesis is right about where the bytes are and slicing is lossless. It is only partly
right about "embeddings unchanged": a text keeps its exact embedding if and only if every sub-word piece it uses was
kept. When one piece is missing, the embedding of that text moves a lot (cosine to the original 0.56 to 0.97 in the
cases seen), there is no graceful degradation.

| | original | `minilm-de-en-trim` | `minilm-latin-trim` |
|---|---|---|---|
| pieces in tokenizer | 250,002 | 61,323 | 114,785 |
| table parameters (rows x 384) | 96,014,208 | 23,548,032 | 44,077,440 |
| `model_quantized.onnx` | 118,308,126 B | 45,841,950 B (38.7 %) | 66,371,358 B (56.1 %) |
| same, `gzip -9` | 73,009,169 B | 31,315,716 B (42.9 %) | 43,125,596 B (59.1 %) |
| `tokenizer.json` | 17,082,913 B | 4,213,858 B | 7,782,520 B |
| same, `gzip -9` | 3,860,370 B | 957,160 B | 1,686,320 B |
| model + tokenizer, raw | 135.4 MB | 50.1 MB (37.0 %) | 74.2 MB (54.8 %) |
| model + tokenizer, gzip | 76.9 MB | 32.3 MB (42.0 %) | 44.8 MB (58.3 %) |

Everything in the model that is not the table is 22.3 MB; that is the floor for this approach.

## Why slicing is exact

- The table is the initializer `embeddings.word_embeddings.weight_quantized`, uint8, 250,037 x 384 = 96.0 MB of the
  118.3 MB file (81 %). Hypothesis confirmed.
- Graph: `Gather(table, input_ids)` first, then one `DequantizeLinear` with a scalar scale (0.0051120017) and a scalar
  zero point (128). Quantization is per tensor, so dropping rows does not touch the remaining rows.
- Nothing else depends on the vocabulary size (checked: no other initializer, constant or shape carries 250,037 or
  250,036). With the table blanked out, original and trimmed file serialize to identical bytes.
- The table has 35 more rows than the tokenizer has pieces (250,037 vs 250,002). No id can reach them; they are dropped.
- Tokenizer: Unigram `vocab` filtered in old-id order, new id = rank. `<s> <pad> </s> <unk>` stay 0 to 3, `<mask>`
  becomes the last id; `unk_id`, `pad_id`, `added_tokens` and the post-processor ids are remapped and asserted.
- Unigram charges unknown characters `min(score) - 10`, so the lowest-scoring piece is always kept; otherwise that
  penalty would shift.
- Measured, not assumed: re-tokenizing every spelling used for the selection with the trimmed tokenizer gives the same
  split. de-en: 24,271 lines, about 4.9 M spellings, 18.0 M tokens, 0 differences. latin: 65,355 lines, about 13 M
  spellings, 54.8 M tokens, 0 differences.
- Identical split means bit-identical embedding: max absolute difference 0.0 on every such text.

## What is kept

`minilm-latin-trim` (no word list): every piece made only of Latin script, digits, punctuation, symbols, emoji, plus
single Greek letters (the micro sign µ is normalized to Greek μ). No piece in this vocabulary mixes Latin letters with
other characters, so any Latin-script word can only ever use these pieces: the split is provably the original one.

`minilm-de-en-trim`, 61,323 pieces:

- 9,436 without any word list: special tokens, 4,502 pieces of only digits/punctuation/symbols/emoji, 4,736 Latin
  pieces of up to 2 characters (so nothing Latin becomes `<unk>`; the lowest-scoring piece is one of them), 193 single
  Greek letters.
- 51,541 from tokenizing the 500,000 most frequent entries of each word list with the original tokenizer, each as
  lower case, Capitalised, UPPER (short or frequent words), German also with ae/oe/ue/ss, and each again after a
  hyphen to get the form without the word-start marker.
- 346 added after the first measurement (see below): 339 Latin pieces with a capital after the first character
  (WhatsApp, iPhone, GmbH, DSGVO, kWh) and 7 from a small own list of URL and file-name parts (http, www, ...).

## Word lists and licence

- Source: `hermitdave/FrequencyWords`, `content/2018/de/de_full.txt` (1,157,685 entries, sha256 `a5fc13f4...`) and
  `content/2018/en/en_full.txt` (1,656,996 entries, sha256 `7fea67ab...`), repository head `525f9b5` (2022-02-07).
  Built from OpenSubtitles 2018. Used: the top 500,000 of each (threshold fixed before the test texts were run).
- Licence according to the repository README: MIT for the code, **CC-BY-SA-4.0 for the content**. Not NC.
- The kept-id list, and with it the trimmed `tokenizer.json` and table, are derived from that content. Whether a list
  of ids is an adaptation in the legal sense is open; the careful reading is that it is. Then, in an AGPL product:
  attribution is required and the list must stay under CC-BY-SA 4.0 (or a licence Creative Commons lists as
  compatible; to my knowledge that is GPLv3, not AGPLv3). So it would ship as a separately licensed data file next to
  the AGPL code, not as AGPL code. Not legal advice.
- `minilm-latin-trim` needs no word list and has none of this.
- The lists and the caches derived from them live under `models/local/_wordlists/` (ignored by git). The result files
  in `results/` contain only counts.
- Not used: Leipzig Corpora Collection. Its website answers automated requests with a bot check, I did not work
  around it, so its licence terms are unverified.

## Verification

onnxruntime 1.32.0, 2 threads, one text per run, mean pooling, L2 normalization. Texts are in `tools/trim_texts/`.

Set A: 320 German + 320 English notes written before the first build (plain, compounds, typos, product names,
URLs/abbreviations, long). Set B: 60 + 60 hard cases only (foreign names, brands, units, paths, typos, loan words),
written after the final rule was fixed and before it was measured.

| de-en variant | set | same split | texts differing | tokens changed | cosine min / 1st pct / median | `<unk>` |
|---|---|---|---|---|---|---|
| first rule (60,977 pieces) | A de | 97.81 % | 7 | 0.25 % | 0.562 / 0.891 / 1.000 | 0 |
| first rule | A en | 97.50 % | 8 | 0.32 % | 0.749 / 0.858 / 1.000 | 0 |
| first rule | B de, B en | 83.3 %, 83.3 % | 10, 10 | not measured | not measured | 0 |
| final rule (61,323 pieces) | A de | 100 % | 0 | 0 % | 1.000 / 1.000 / 1.000 | 0 |
| final rule | A en | 99.69 % | 1 | 0.06 % | 0.749 / 1.000 / 1.000 | 0 |
| final rule | B de | 100 % | 0 | 0 % | 1.000 / 1.000 / 1.000 | 0 |
| final rule | B en | 98.33 % | 1 | 0.16 % | 0.872 / 0.947 / 1.000 | 0 |

`minilm-latin-trim`: 100 % same split and cosine 1.000 on all of A and B.

What went wrong with the first rule: all 15 failures in set A were in product names, URLs/abbreviations and one typo,
none in the 460 plain, compound and long notes. The subtitle lists are lower case and from 2018, so they cannot supply `WhatsApp`,
`iPhone`, `iOS`, `SharePoint`, `GmbH`, `DSGVO`, `GDPR`, `https`, `www`. The 346 extra pieces fix that class. The final
rule was therefore designed after looking at set A; its set A numbers are optimistic, set B is the fairer figure.

What still fails with the final rule (2 of 760 texts): English typos that happen to be words of another Latin-script
language and therefore have their own piece: `transparancy` (Indonesian `transparan`, cosine 0.749) and `tiket`
(cosine 0.872). This class cannot be closed by a longer German/English list in general.

Corpus `corpus/corpus.json` (680 texts; sha256 `e4694176...`, file time 2026-11-21 23:48:21): both variants 100 % same
split, cosine min = median = 1.000, 0 texts below 0.999, pair cosines of `duplicates` and `nearMisses` unchanged. The
first rule also reached 100 % here.

Outside the target languages (20 texts each, 10 for ru/ar/zh), cosine to the original:

| language | de-en: same split | de-en: cosine min / median | de-en: `<unk>` share | latin: same split | latin: `<unk>` share |
|---|---|---|---|---|---|
| French | 75 % | 0.676 / 1.000 | 0 % | 100 % | 0 % |
| Spanish | 35 % | 0.693 / 0.995 | 0 % | 100 % | 0 % |
| Polish | 10 % | 0.559 / 0.883 | 0 % | 100 % | 0 % |
| Turkish | 5 % | 0.322 / 0.875 | 0 % | 100 % | 0 % |
| Russian | 0 % | 0.031 / 0.122 | 19.5 % | 0 % | 49.0 % |
| Arabic | 0 % | 0.041 / 0.122 | 48.2 % | 0 % | 48.2 % |
| Chinese | 0 % | -0.051 / 0.072 | 50.0 % | 0 % | 50.0 % |

So de-en splits other Latin-script languages into small fragments (no `<unk>`, but a different and worse vector), and
both variants turn non-Latin scripts into `<unk>` runs. Those embeddings are useless and nothing signals it.

List length against size and same-split share (final rule, tokenizer only):

| top words per language | pieces | model | A de | A en | B de | B en | corpus |
|---|---|---|---|---|---|---|---|
| 50,000 | 43,212 | 38.9 MB | 95.3 % | 95.9 % | 88.3 % | 88.3 % | 98.8 % |
| 100,000 | 48,426 | 40.9 MB | 98.8 % | 98.1 % | 95.0 % | 91.7 % | 99.7 % |
| 200,000 | 53,781 | 42.9 MB | 100 % | 98.8 % | 98.3 % | 95.0 % | 100 % |
| 500,000 (built) | 61,323 | 45.8 MB | 100 % | 99.7 % | 100 % | 98.3 % | 100 % |
| all (1.16 M / 1.66 M) | 73,487 | 50.5 MB | 100 % | 100 % | 100 % | 100 % | 100 % |

The 100 % in the last row means the two typos above happen to occur in the tail of the subtitle lists. It is not a
guarantee for the next typo.

transformers.js 4.3.2 in Node 22 (onnxruntime-node): both outputs load with `dtype: "q8"`; three sentences give cosine
1.000000 against the original; over 1,443 texts (A, B, corpus) the same two texts as in Python fall below 0.999, with
the same values. The JavaScript tokenizer therefore splits like the Rust one.

## Not verified, and limits of this measurement

- No run in a browser (WASM or WebGPU). Only Python onnxruntime and transformers.js in Node.
- Only the q8 file was trimmed. fp16 and fp32 were not built or tested.
- Load time and memory were not measured.
- All test texts were written by the same agent that built the selection, and set B was written knowing the final
  rule. The samples are small: 2 of 760 is a rough figure, not a rate to plan with.
- 11 German notes in set A have 2 words, below the requested minimum of 3.
- Texts longer than 128 tokens were not tested.
- The corpus was read in the state named above; it was still being written by another agent.
- `config.json` keeps `pad_token_id: 0` although the tokenizer pads with id 1. That mismatch is in the original.

## Recommendation

- If 66 MB is acceptable: take `minilm-latin-trim`. It is exact for every Latin-script text, needs no word list and no
  third-party licence, and saves 44 %.
- If size decides: `minilm-de-en-trim` saves 61 %. Expect a small share of notes (typos, rare foreign words) to get a
  clearly different vector, and other Latin-script languages to degrade. The list licence has to be handled, or the
  list regenerated from another source.
- Either way the product needs a rule for notes in non-Latin scripts (detect and fall back to the full model, or
  refuse), because both variants fail there silently.

## Reproduce

```
uv venv --python 3.13 .venv && uv pip install --python .venv/bin/python onnx onnxruntime numpy tokenizers regex
.venv/bin/python tools/trim_vocab.py            # both variants -> models/local/, numbers in results/trim-build.json
.venv/bin/python tools/trim_vocab.py --variant de-en --no-extras   # the first rule; overwrites the de-en output
.venv/bin/python tools/trim_verify.py           # results/trim-verify.json (first rule: results/trim-verify-v1.json)
node tools/trim_check.mjs --all                 # transformers.js in Node
```
