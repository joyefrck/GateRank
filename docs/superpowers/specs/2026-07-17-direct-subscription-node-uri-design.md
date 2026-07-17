# Direct Subscription Node URI Support Design

## Goal

Allow the GateRank admin subscription-node capture action to accept either an HTTP(S) subscription endpoint or one directly supported node URI, including the reported VLESS Reality link.

## Scope

- Continue supporting existing `http://` and `https://` subscription endpoints without changing their fetch, normalization, or parsing behavior.
- Accept direct node URIs for every scheme already handled by `parse_node_line`: `vless://`, `vmess://`, `trojan://`, `ss://`, and `anytls://`.
- Keep unsupported URI schemes and malformed supported URIs on the existing capture-failure path.
- Update the admin form copy so operators know the field accepts a subscription endpoint or a direct node URI.

## Design

`fetch_parsed_subscription` remains the boundary that converts the saved field value into parsed nodes. Before trying the two HTTP User-Agent variants, it will detect a supported direct-node scheme. A direct URI is normalized as plain subscription text and parsed locally, bypassing `fetch_subscription` entirely. HTTP(S) values continue through the existing two-attempt remote-fetch loop.

The change stays inside the capture script because downstream snapshot storage and performance selection already consume `ParsedNode` values and do not need a new data shape. A direct URI produces the same `plain` subscription format and snapshot fields as an HTTP subscription response containing that one URI.

## Error Handling

A well-formed supported direct URI must yield at least one parsed node. If parsing produces no supported node, capture fails with the existing `subscription_fetch_or_parse_failed` result. This design does not broaden accepted schemes or silently reinterpret arbitrary non-HTTP input.

## Tests

- Add a regression test using a VLESS Reality URI and assert that it parses successfully without calling `fetch_subscription`.
- Verify the resulting node keeps the expected protocol, server, port, flow, TLS, and Reality settings.
- Keep the existing HTTP subscription tests as regression coverage for the unchanged remote-fetch behavior.
- Run the focused Python subscription-capture tests and the broader monitor test module.

## Security

Direct node credentials continue to be stored and redacted under the same snapshot and error-handling rules already used for node URIs returned by remote subscriptions. API responses and audit logs must not expose `raw_uri` or credentials.
