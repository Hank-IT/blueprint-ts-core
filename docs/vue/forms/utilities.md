# Utilities

Update multiple fields at once:

```ts
form.fillState({ name: 'John Doe', email: 'john@example.com' })
```

Synchronize a value without marking dirty:

```ts
form.syncValue('email', 'new@example.com')
```

Reset the form to its original state:

```ts
form.reset()
```

Convert `properties` back to raw data:

```ts
import { propertyAwareToRaw } from '@blueprint-ts/core/vue/forms'

const raw = propertyAwareToRaw<FormState>(form.properties)
```
