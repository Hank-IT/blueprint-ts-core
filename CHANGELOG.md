## v3.0.0 - 2026-02-19

# [3.0.0](/compare/v2.0.0...v3.0.0) (2026-02-19)


### Features

* Omit BaseForm fields when transformer returns undefined 26c0d0e
* Removed suggestions feature from BaseForm.ts f21d6ce
* Support file uploads in BaseForm and improve form data handling in requests d765cae
## v2.0.0 - 2026-02-18

# [2.0.0](/compare/v1.2.0...v2.0.0) (2026-02-18)


### Features

* Cache resolved route resources for child routes db70b77
## v1.2.0 - 2026-01-25

# [1.2.0](/compare/v1.1.2...v1.2.0) (2026-01-25)


### Features

* Added state paginator feature 87a9466
## v1.1.2 - 2026-01-09

## [1.1.2](/compare/v1.1.1...v1.1.2) (2026-01-09)


### Bug Fixes

* Adjusted PropertyAware type 893f705
* Change @ts-expect-error to @ts-ignore to prevent errors in consuming projects 346a5b0
## v1.1.1 - 2026-01-08

## [1.1.1](/compare/v1.1.0...v1.1.1) (2026-01-08)
## v1.1.0 - 2026-01-07

# 1.1.0 (2026-01-07)


### Bug Fixes

* Added BulkRequestExecutionMode enum to export a284ac8
* Added missing exports c90cc0b
* Added missing exports for types 8de86cb
* Added persistence enhancements and dynamic suffix support. Fix: Improved typing 614cd9d
* Adjust access token var name in publishing script 81efc7b
* Fix imports in persistenceDrivers 5ee838e
* Fix paths for state b5af348
* Fix typescript errors in state class b7c6809
* Import BaseRequestContract as type c639617
* Make BaseForm accept different types in RequestBody and FormBody 227d0e8
* Make request methods uppercase fac7c07
* Prevent subscriptions from being triggered multiple times by the same event 890d9db
* Recreate AbortController before sending requests 876c4e3
* Rename appends to append; chore: Lower type constraints for FormBody; chore: Bump up version to 2.7.1 d37e7f5


### Features

* Added BaseForm and Array Pagination Driver def6b52
* Added batch loader e6a8ebb
* Added bulk requests feature df2055f
* Added checked ref to useGlobalCheckbox composable ddcceee
* Added ci scripts 89e8417
* Added DeferredPromise; feat: Added supports export ba9a1c3
* Added getBody method f1e7dc3
* Added getRequest() method to RequestDriver; feat: Added Access to dataDriver to Paginator; feat: Generate uuid per request; fix: Ensure request params arent mutated; chore: Added Tests for mergeDeep and ignore some typescript errors 8202db6
* Added helper for setting abort signal on request b2679c4
* Added initial loading state to vue request loader 6b34b82
* Added mode feature to BulkRequestSender; feat: Added retry feature to BulkRequestSender ea27dec
* Added off method to BulkRequestSender to clear event listeners 12593e3
* Added PropertyAwareArray class which enables the array to property conversion feature 5c23c89
* Added propertyAwareToRaw() helper; chore: Bump up version to 3.1.0 8a12a7e
* Added script for publishing docs c29d3a6
* Added sent state and removed semicolons 8d7b56c
* Added setRequests method to BulkRequestSender e377538
* Added some array helper methods to BaseForm 98cd03e
* Added State class; Added vitepress with documentation for forms and states 3f519ed
* Added sync value method 9ea03c1
* Added types for PropertyAwareArray; Bump up version to 3.2.0 137ba48
* Added useRouteResource composable with refresh method 60f5435
* Added validation to BaseForm ba5a342
* Added viewDriverFactory param (via options object) to paginator 63533d0
* Added vue route model binding feature fcf4330
* Allow form class to dynamically generate properties, ignore certain properties and remap errors to different fields ca65690
* Ignore some type errors 6f08557
* Improve docs building 5be5af0
* Improve global checkbox handling 30d2756
* Improve global checkbox handling 0bcf75d
* Improve state class 649963b
* Improved typing in bulk request feature edc6cc2
* Make PropertyAwareArray a subtype of array 9e2e05e
* Make VueRequestLoader track requests; fix: useIsOpenFromVar should always return a boolean as isOpenFromVar 5579aa1
* Move persistence drivers to own service and make them more generic dbe27a9
* Refactored composables cf86741
* Refactored library using typescript; Bump version to 2.0.0 ba17085
* Refactored loading feature 0f8163d
* Refactored PropertyAwareArray to inherit array; Adjustd BaseForm accordingly 1c85f2e
* Resolve callbacks in header object to string f7534bb
