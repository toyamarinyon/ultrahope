# Ultrahope CLI

```
npm install -g ultrahope
```

> This document represents to-be, not as-is

### Available Commands

- ultrahope translate [OPTION]

    ```
    git diff | ultrahope translate --target vcs-commit-message
    ```

    ```
    git log main..HEAD -p | ultrahope translate --target --pr-title-body
    ```

    ```
    gh pr diff 1234 --patch | ultrahope translate --target --pr-intent
    ```

- ultrahope login

    login with device flow
