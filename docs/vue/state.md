# State Management

## Overview
The `State` class provides a reactive, type-safe state management system with rich features like change detection, nested property watching, persistence, and more. It's designed to make state management in Vue applications clean and flexible.

## Core Features
- **Type-safe state**: Fully typed with TypeScript generics
- **Reactive properties**: Seamless integration with Vue's reactivity system
- **Nested property watching**: Track changes to deeply nested properties
- **Persistence options**: Optional state persistence between sessions
- **Change subscriptions**: React to state changes with optional debouncing
- **Deep object watching**: Special handling for nested objects
- **Efficient equality checking**: Smart comparison of state values
- **State export/import**: Easily serialize and deserialize state
- **Reset capability**: Revert to initial state when needed

## Usage Guide
### Creating a State Class
Create a new state by extending the base class and defining your interface:

```typescript
import { State } from '@blueprint-ts/core/vue/state'
import { type PersistenceDriver, LocalStorageDriver } from '@blueprint-ts/core/persistenceDrivers'

// Define your state interface
interface UserStateInterface {
  name: string;
  email: string;
  preferences: {
    darkMode: boolean;
    notifications: boolean;
  };
}

// Create your state class
class UserState extends State<UserStateInterface> {
  constructor() {
    super(
      {
        name: '',
        email: '',
        preferences: {
          darkMode: false,
          notifications: true
        }
      }, 
      {
        persist: true, // Enable persistence
        persistSuffix: 'user' // Optional namespace for the storage key
      }
    );
  }
  
  // Optional: Override persistence method
  protected override getPersistenceDriver(): PersistenceDriver {
    return new LocalStorageDriver()
  }
}

// Create an instance
export const userState = new UserState();
```

### Accessing State

````typescript
// Read
const userName = userState.state.name;

// Write
userState.state.name = 'John Doe';
````

### Subscribing to Changes
Listen for changes to specific properties using the method: `subscribe`

#### Basic subscription to a single property
````typescript
// Subscribe to changes on a top-level property
userState.subscribe(
  'name',
  (newValue, oldValue) => {
    console.log(`Name changed from ${oldValue} to ${newValue}`);
  }
);
````

`subscribe` returns an unsubscribe function:

````typescript
const unsubscribe = userState.subscribe('name', () => {
  // ...
});

unsubscribe();
````

#### Subscribing to nested properties

````typescript
// Subscribe to a nested property using dot notation
userState.subscribe(
  'preferences.darkMode',
  (newValue, oldValue) => {
    console.log(`Dark mode changed from ${oldValue} to ${newValue}`);
    // Update UI theme
  }
);
````

#### Debounced subscriptions

````typescript
// Debounce the handler to avoid frequent updates
userState.subscribe(
  'email',
  (newValue, oldValue) => {
    // This will only execute after 300ms of stability
    validateEmail(newValue);
  },
  { debounce: 300 }
);
````

#### Watching multiple properties
````typescript
// Subscribe to multiple properties at once
userState.subscribe(
  ['name', 'email'],
  (changedPath, state) => {
    console.log(`Property ${changedPath} changed`);
    console.log('Current state:', state);
  }
);
````

### State Persistence
Enable state persistence by passing `persist: true` in the constructor options. You can optionally set `persistSuffix` to namespace the storage key. Override the method `getPersistenceDriver` to use different storage mechanisms:

````typescript
// Examples of different persistence drivers:
protected override getPersistenceDriver(): PersistenceDriver {
  // Session storage (lasts until browser tab is closed)
  return new SessionStorageDriver();
  
  // Local storage (persists between sessions)
  // return new LocalStorageDriver();
  
  // Non-persistent (for testing or when persistence not needed)
  // return new NonPersistentDriver();
}
````

You can inspect the computed key via `state.persistKey`.

### Importing and Exporting State

Export the current state to a plain object or import values:

````typescript
// Export current state as a plain object
const stateSnapshot = userState.export();
console.log(stateSnapshot);

// Import partial state
userState.import({
  name: 'Jane Doe',
  preferences: {
    darkMode: true
  }
});

````

### Resetting State
Reset the state to its initial values:

````typescript
// Reset to initial values
userState.reset();
````

````
userState.subscribe(
  'name',
  (newValue, oldValue) => {
    console.log(`Name reset from ${oldValue} to ${newValue}`);
  },
  { executeOnReset: true }
);
````

### Cleanup
If you create short‑lived state instances, call `destroy()` to remove watchers and release references:

````typescript
userState.destroy();
````

## Advanced Features
### Deep Object Watching
When you modify nested properties, the system automatically detects these changes and triggers appropriate callbacks:

````typescript
// Both of these will trigger the 'preferences.darkMode' subscription
userState.state.preferences.darkMode = true;
userState.state.preferences = { darkMode: true, notifications: false };
````

### Type-Safe Path Access
The state system enforces type safety for property paths:

````typescript
// TypeScript will error on invalid paths
userState.subscribe(
  'preferences.invalidProperty', // Type error!
  (newValue, oldValue) => {
    // ...
  }
);
````

### Smart Comparison
The system performs deep equality checks before triggering change handlers, ensuring callbacks are only called when values actually change:

````typescript
// This won't trigger change handlers if the values are deeply equal
userState.state.preferences = { darkMode: false, notifications: true };
````

## Example: Complete Workflow

````typescript
// 1. Define state interface
interface FormState {
  username: string;
  password: string;
  validation: {
    usernameValid: boolean;
    passwordValid: boolean;
  };
}

// 2. Create state class
class FormStateManager extends State<FormState> {
  constructor() {
    super({
      username: '',
      password: '',
      validation: {
        usernameValid: false,
        passwordValid: false
      }
    });
  }
  
  // Helper methods can be added to state classes
  public validateForm(): boolean {
    return this.state.validation.usernameValid && 
           this.state.validation.passwordValid;
  }
}

// 3. Create instance
const formState = new FormStateManager();

// 4. Set up subscriptions
formState.subscribe(
  'username',
  (username) => {
    // Validate username
    const valid = username.length >= 3;
    formState.state.validation.usernameValid = valid;
  },
  { debounce: 300 }
);

formState.subscribe(
  'password',
  (password) => {
    // Validate password
    const valid = password.length >= 8;
    formState.state.validation.passwordValid = valid;
  },
  { debounce: 300 }
);

// 5. Watch form validity
formState.subscribe(
  ['validation.usernameValid', 'validation.passwordValid'],
  (_, state) => {
    const submitButton = document.getElementById('submit');
    if (formState.validateForm()) {
      submitButton.disabled = false;
    } else {
      submitButton.disabled = true;
    }
  }
);

// 6. Use the state
formState.state.username = 'john_doe';
formState.state.password = 'securePassword123';

// 7. Reset when needed
document.getElementById('reset').addEventListener('click', () => {
  formState.reset();
});
````
