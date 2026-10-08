# Saving Form Values

Provide the complete initial values to the form constructor. These values are the baseline used by `isDirty()` and `reset()`. Include generated IDs and other defaults before constructing the form. Changes made afterward, including `fill()`, are edits.

## Accepting saved values

After a save succeeds, call `acceptSavedValues()` to use the current editable values as the new baseline. It clears touched state and updates a persisted draft when persistence is enabled. `isDirty()` then returns `false`, and `reset()` returns to those accepted values.

<<< ../../examples/v6.ts#form

Without an argument, acceptance uses the values present when the method is called.

## Accepting server values

If the response normalizes values, pass the complete saved form state to `acceptSavedValues(values)`:

```ts
const response = await new SaveNameRequest().setBody(form.buildPayload()).send()
form.acceptSavedValues(response.getBody())
```

Explicit values replace both the current values and the baseline. Map the response first when its shape differs from editable values. A failed operation should leave the baseline unchanged.

## Saving locally

The caller chooses where to store the payload. For example, a form can save to browser storage:

<<< ../../examples/v6.ts#localSave

`buildPayload()` applies form transformations. [`getStateSnapshot()`](./state-and-properties#state-snapshots) provides an independent copy of editable values when an operation needs one. Those values can contain richer objects than the saved payload; use the form state shape when supplying explicit values to `acceptSavedValues(values)`.

## Loading and errors

The request or calling operation owns pending state and error handling. Use the request loader for an HTTP operation, or an operation flag when saving involves several asynchronous steps. Guard duplicate Save actions for the duration of that operation.

When a component can close or switch resources during an operation, the component should guard its own navigation and notification side effects. Form values and baselines do not control request lifetimes.
