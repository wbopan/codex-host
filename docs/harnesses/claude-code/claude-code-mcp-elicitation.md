# Claude MCP approval elicitation

Claude loads user-scoped MCP servers through its native SDK configuration. MCP servers can also request confirmation with `elicitation/create`. The Adapter registers the SDK `onElicitation` callback so these confirmations reach the existing Desktop approval UI.

Only form-mode requests with an empty object schema are supported. The UI shows the MCP server name and the full request message. Allow once returns `accept` with empty content; denial returns `decline`. Aborting the SDK request, closing the transport, or ending its active Turn returns `cancel` and closes the prompt. Permanent and Session-wide choices are rejected because the SDK does not carry the server's permission-persistence metadata through this callback.

Forms requiring user fields, URL authentication, unknown schema constraints, and messages longer than the UI's 500-character description limit are declined. No fields are invented, no URLs are automatically opened, and permission mode does not automatically answer elicitation. Tool approval remains separate from MCP server confirmation.

This callback supplies approval transport only. It does not grant access to Desktop native pipes, disable Computer Use application restrictions, or establish Browser Use availability. Each native provider still performs its own authorization and must be verified independently.
