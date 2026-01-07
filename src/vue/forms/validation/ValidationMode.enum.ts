export enum ValidationMode {
  // Individual flags
  NEVER = 0,
  INSTANTLY = 1, // Validate as soon as form is initialized
  ON_TOUCH = 2, // Validate when field is touched (focused/blurred)
  ON_DIRTY = 4, // Validate when field value changes
  ON_SUBMIT = 8, // Validate on form submit
  ON_DEPENDENT_CHANGE = 16, // Validate when a field it depends on changes

  // Common combinations
  DEFAULT = ON_TOUCH | ON_DIRTY | ON_SUBMIT, // Validate when dirty or on submit
  AGGRESSIVE = INSTANTLY | ON_TOUCH | ON_DIRTY | ON_SUBMIT, // Validate in all situations
  PASSIVE = ON_SUBMIT // Only validate on submit
}
