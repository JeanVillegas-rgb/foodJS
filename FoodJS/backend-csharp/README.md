# FoodJS C# API

ASP.NET Core replacement for the authentication and profile endpoints used by the React frontend. It keeps the existing JSON datastore at `../backend/data/users.json`.

## Run

```powershell
dotnet run --project .\FoodJS\backend-csharp\FoodJS.Api.csproj
```

The API listens on `http://localhost:3001` and provides:

- `GET /api/health`
- `POST /api/users/register`
- `POST /api/users/login`
- `GET /api/users`
- `GET /api/users/me`
- `PATCH /api/users/me`

Set `JWT_SECRET` to a 32-character-or-longer secret for non-development use. The existing Node backend remains available while the remaining route families are migrated.
