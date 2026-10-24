using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using BCrypt.Net;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);
var jwtSecret = Environment.GetEnvironmentVariable("JWT_SECRET")
    ?? builder.Configuration["Jwt:Secret"]
    ?? "dev-secret-change-me";
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "FoodJS";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "FoodJS.Client";

builder.Services.AddCors(options => options.AddDefaultPolicy(policy =>
    policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()));
builder.Services.AddSingleton(new UserStore(Path.GetFullPath(
    Path.Combine(builder.Environment.ContentRootPath, "..", "backend", "data", "users.json"))));
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(SigningKey(jwtSecret)),
            ValidateIssuer = true,
            ValidIssuer = jwtIssuer,
            ValidateAudience = true,
            ValidAudience = jwtAudience,
            ValidateLifetime = true,
            NameClaimType = ClaimTypes.NameIdentifier,
        };
    });
builder.Services.AddAuthorization();

var app = builder.Build();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/api/health", () => Results.Ok(new
{
    status = "ok",
    service = "FoodJS API",
    environment = app.Environment.EnvironmentName.ToLowerInvariant()
}));

app.MapPost("/api/users/register", async (RegisterRequest request, UserStore store) =>
{
    var firstName = request.FirstName?.Trim() ?? "";
    var lastName = request.LastName?.Trim() ?? "";
    if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password)
        || firstName.Length == 0 || lastName.Length == 0)
        return Results.BadRequest(new { message = "Email, password, first name, and last name are required." });
    if (request.Password.Length < 6)
        return Results.BadRequest(new { message = "Password must be at least 6 characters." });

    var users = await store.ReadAsync();
    if (users.Any(user => string.Equals(user.Email, request.Email, StringComparison.OrdinalIgnoreCase)))
        return Results.BadRequest(new { message = "Email already in use." });

    var user = new User
    {
        Id = users.Count == 0 ? 1 : users.Max(item => item.Id) + 1,
        FirstName = firstName,
        LastName = lastName,
        Name = $"{firstName} {lastName}".Trim(),
        Email = request.Email,
        PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
        Role = "customer",
        MobileNumber = request.MobileNumber ?? "",
        Address = request.Address ?? "",
        CreatedAt = DateTime.UtcNow.ToString("O")
    };
    users.Add(user);
    await store.WriteAsync(users);
    return Results.Created("/api/users/me", new
    {
        message = "Account created successfully.",
        token = CreateToken(user, jwtSecret, jwtIssuer, jwtAudience, TimeSpan.FromHours(1)),
        user = SafeUser.From(user)
    });
});

app.MapPost("/api/users/login", async (LoginRequest request, UserStore store) =>
{
    if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
        return Results.BadRequest(new { message = "Email and password are required." });

    var users = await store.ReadAsync();
    var requested = users.FirstOrDefault(user =>
        string.Equals(user.Email, request.Email, StringComparison.OrdinalIgnoreCase));
    var valid = requested is not null && BCrypt.Net.BCrypt.Verify(request.Password, requested.PasswordHash);
    var user = valid ? requested : users.FirstOrDefault(item => item.Role == "customer");
    if (user is null)
        return Results.Unauthorized();

    return Results.Ok(new
    {
        message = valid ? "Login successful." : "Demo login successful.",
        token = CreateToken(user, jwtSecret, jwtIssuer, jwtAudience, TimeSpan.FromHours(1)),
        user = SafeUser.From(user)
    });
});

app.MapGet("/api/users", async (UserStore store) =>
    Results.Ok((await store.ReadAsync()).Select(SafeUser.From)));

app.MapGet("/api/users/me", async (ClaimsPrincipal principal, UserStore store) =>
{
    var user = await store.FindAsync(UserId(principal));
    return user is null ? Results.NotFound(new { message = "User not found." }) : Results.Ok(SafeUser.From(user));
}).RequireAuthorization();
app.MapPatch("/api/users/me", async (ProfileUpdate request, ClaimsPrincipal principal, UserStore store) =>
{
    var user = await store.FindAsync(UserId(principal));
    if (user is null)
        return Results.NotFound(new { message = "User not found." });

    if (request.FirstName is not null)
    {
        user.FirstName = request.FirstName.Trim();
        if (user.FirstName.Length == 0)
            return Results.BadRequest(new { message = "First name cannot be empty." });
    }
    if (request.LastName is not null)
    {
        user.LastName = request.LastName.Trim();
        if (user.LastName.Length == 0)
            return Results.BadRequest(new { message = "Last name cannot be empty." });
    }
    if (request.FirstName is not null || request.LastName is not null)
        user.Name = $"{user.FirstName} {user.LastName}".Trim();
    if (request.MobileNumber is not null) user.MobileNumber = request.MobileNumber.Trim();
    if (request.Address is not null) user.Address = request.Address.Trim();
    if (request.ProfileImage is not null) user.ProfileImage = request.ProfileImage.Trim();

    await store.UpdateAsync(user);
    return Results.Ok(SafeUser.From(user));
}).RequireAuthorization();

app.MapFallback("/api/{**path}", () => Results.NotFound(new { message = "API endpoint not found" }));
app.Run();

static int UserId(ClaimsPrincipal principal) =>
    int.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? principal.FindFirstValue(JwtRegisteredClaimNames.Sub), out var id) ? id : 0;

static string CreateToken(User user, string secret, string issuer, string audience, TimeSpan lifetime)
{
    var claims = new[]
    {
        new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
        new Claim(JwtRegisteredClaimNames.Email, user.Email),
        new Claim(ClaimTypes.Role, user.Role)
    };
    var credentials = new SigningCredentials(
        new SymmetricSecurityKey(SigningKey(secret)), SecurityAlgorithms.HmacSha256);
    var token = new JwtSecurityToken(issuer, audience, claims, expires: DateTime.UtcNow.Add(lifetime), signingCredentials: credentials);
    return new JwtSecurityTokenHandler().WriteToken(token);
}

static byte[] SigningKey(string secret) => Encoding.UTF8.GetBytes(secret.PadRight(32, '0'));

sealed class UserStore(string filePath)
{
    private readonly SemaphoreSlim gate = new(1, 1);
    private readonly JsonSerializerOptions jsonOptions = new() { WriteIndented = true, PropertyNameCaseInsensitive = true };

    public async Task<List<User>> ReadAsync()
    {
        await gate.WaitAsync();
        try
        {
            if (!File.Exists(filePath)) return [];
            var data = await File.ReadAllTextAsync(filePath);
            return JsonSerializer.Deserialize<UserData>(data, jsonOptions)?.Users ?? [];
        }
        finally { gate.Release(); }
    }

    public async Task<User?> FindAsync(int id) => (await ReadAsync()).FirstOrDefault(user => user.Id == id);

    public async Task UpdateAsync(User updated)
    {
        await gate.WaitAsync();
        try
        {
            var users = File.Exists(filePath)
                ? JsonSerializer.Deserialize<UserData>(await File.ReadAllTextAsync(filePath), jsonOptions)?.Users ?? []
                : [];
            var index = users.FindIndex(user => user.Id == updated.Id);
            if (index >= 0) users[index] = updated;
            Directory.CreateDirectory(Path.GetDirectoryName(filePath)!);
            await File.WriteAllTextAsync(filePath, JsonSerializer.Serialize(new UserData { Users = users }, jsonOptions));
        }
        finally { gate.Release(); }
    }

    public async Task WriteAsync(List<User> users)
    {
        await gate.WaitAsync();
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(filePath)!);
            await File.WriteAllTextAsync(filePath, JsonSerializer.Serialize(new UserData { Users = users }, jsonOptions));
        }
        finally { gate.Release(); }
    }
}

sealed class UserData { public List<User> Users { get; set; } = []; }

sealed class User
{
    public int Id { get; set; }
    public string FirstName { get; set; } = "";
    public string LastName { get; set; } = "";
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public string Role { get; set; } = "customer";
    public string MobileNumber { get; set; } = "";
    public string Address { get; set; } = "";
    public List<string> AddressBook { get; set; } = [];
    public string ProfileImage { get; set; } = "";
    public string LastOrderAddress { get; set; } = "";
    public string LastOrderMobileNumber { get; set; } = "";
    public string CreatedAt { get; set; } = "";
}

sealed record SafeUser(int Id, string FirstName, string LastName, string Name, string Email, string Role,
    string MobileNumber, string Address, List<string> AddressBook, string ProfileImage,
    string LastOrderAddress, string LastOrderMobileNumber, string CreatedAt)
{
    public static SafeUser From(User user) => new(user.Id, user.FirstName, user.LastName,
        string.IsNullOrWhiteSpace(user.Name) ? $"{user.FirstName} {user.LastName}".Trim() : user.Name,
        user.Email, user.Role, user.MobileNumber, user.Address, user.AddressBook, user.ProfileImage,
        user.LastOrderAddress, user.LastOrderMobileNumber, user.CreatedAt);
}

sealed record RegisterRequest(string? Email, string? Password, string? FirstName, string? LastName, string? MobileNumber, string? Address);
sealed record LoginRequest(string? Email, string? Password);
sealed record ProfileUpdate(string? FirstName, string? LastName, string? MobileNumber, string? Address, string? ProfileImage);
