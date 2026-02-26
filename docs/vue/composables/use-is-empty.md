# `useIsEmpty`

`useIsEmpty` provides small helpers to check whether a value should be treated as empty.

## What It Considers Empty

- `undefined`, `null`, and `''`
- arrays with `length === 0`
- plain objects with no keys (checked via `lodash-es` `isEmpty`)

Everything else is treated as not empty.

## Example

```ts
import { useIsEmpty } from '@blueprint-ts/core/vue'

const { isEmpty, isNotEmpty } = useIsEmpty()

isEmpty(null) // true
isEmpty('') // true
isEmpty([]) // true
isEmpty({}) // true

isNotEmpty('Hello') // true
```
