import fs from "fs/promises";
import path from "path";

export interface User {
    username: string;
    password: string;
}

export interface UsersFile {
    users: User[];
}

const usersFilePath = path.join(process.cwd(), "data", "users.json");

async function ensureDataDirectory() {
    await fs.mkdir(path.dirname(usersFilePath), { recursive: true });
}

async function readUsersFile(): Promise<UsersFile> {
    try {
        await ensureDataDirectory();
        const content = await fs.readFile(usersFilePath, "utf8");
        const parsed = JSON.parse(content ?? "{}");
        return {
            users: Array.isArray(parsed?.users) ? parsed.users : [],
        };
    } catch {
        await writeUsersFile({ users: [] });
        return { users: [] };
    }
}

async function writeUsersFile(data: UsersFile) {
    await ensureDataDirectory();
    await fs.writeFile(usersFilePath, JSON.stringify(data, null, 2), "utf8");
}

export async function ensureUsersFile() {
    await readUsersFile();
}

export async function getAllUsers() {
    const data = await readUsersFile();
    return data.users;
}

export async function getUserByUsername(username: string) {
    const data = await readUsersFile();
    return data.users.find((user) => user.username === username) ?? null;
}

export async function validateUser(username: string, password: string) {
    const user = await getUserByUsername(username);
    return user?.password === password;
}

export async function createUser(username: string, password: string) {
    const data = await readUsersFile();
    const normalized = username.trim();
    if (!normalized) {
        throw new Error("Username is required");
    }
    if (data.users.some((user) => user.username === normalized)) {
        throw new Error("User already exists");
    }
    data.users.push({ username: normalized, password });
    await writeUsersFile(data);
    return normalized;
}

export async function deleteUser(username: string) {
    const data = await readUsersFile();
    const normalized = username.trim();
    const nextUsers = data.users.filter((user) => user.username !== normalized);
    if (nextUsers.length === data.users.length) {
        throw new Error("User not found");
    }
    await writeUsersFile({ users: nextUsers });
    return normalized;
}
