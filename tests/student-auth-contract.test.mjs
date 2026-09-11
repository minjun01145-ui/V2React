import assert from "node:assert/strict";
import fs from "node:fs";
import { parse } from "@babel/parser";

function parseTypeScript(relativeUrl) {
  const sourcePath = new URL(relativeUrl, import.meta.url);
  return parse(fs.readFileSync(sourcePath, "utf8"), {
    sourceType: "module",
    plugins: ["typescript"],
  }).program;
}

function descendants(node) {
  const values = [];
  const visit = (value) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (typeof value.type === "string") values.push(value);
    for (const [key, child] of Object.entries(value)) {
      if (!["loc", "start", "end", "extra"].includes(key)) visit(child);
    }
  };
  visit(node);
  return values;
}

function topLevelDeclarations(program) {
  return program.body.map((statement) => statement.type === "ExportNamedDeclaration" ? statement.declaration : statement).filter(Boolean);
}

function functionDeclaration(program, name) {
  const declaration = topLevelDeclarations(program).find((statement) => statement.type === "FunctionDeclaration" && statement.id?.name === name);
  assert.ok(declaration?.body, `student auth source must define ${name}`);
  return declaration;
}

function namedInitializer(program, name) {
  const functionMatch = topLevelDeclarations(program).find((statement) => statement.type === "FunctionDeclaration" && statement.id?.name === name);
  if (functionMatch) return functionMatch;
  for (const statement of topLevelDeclarations(program)) {
    if (statement.type !== "VariableDeclaration") continue;
    const declaration = statement.declarations.find((item) => item.id.type === "Identifier" && item.id.name === name);
    if (declaration?.init) return declaration.init;
  }
  assert.fail(`student auth source must define ${name}`);
}

function importedBinding(program, moduleName, importedName) {
  for (const statement of program.body) {
    if (statement.type !== "ImportDeclaration" || statement.source.value !== moduleName) continue;
    const match = statement.specifiers.find((specifier) => specifier.type === "ImportSpecifier" && specifier.imported.name === importedName);
    if (match) return match.local.name;
  }
  assert.fail(`studentAuth.ts must import ${importedName} from ${moduleName}`);
}

function callsIdentifier(node, identifier) {
  return descendants(node).some((child) => child.type === "CallExpression"
    && child.callee.type === "Identifier"
    && child.callee.name === identifier);
}

function callsMethodWithString(node, methodName, value) {
  return descendants(node).some((child) => child.type === "CallExpression"
    && child.callee.type === "MemberExpression"
    && !child.callee.computed
    && child.callee.property.type === "Identifier"
    && child.callee.property.name === methodName
    && child.arguments[0]?.type === "StringLiteral"
    && child.arguments[0].value === value);
}

function assertCallableContract(program, functionName, callableName, anonymousUserName, httpsCallableName) {
  const declaration = functionDeclaration(program, functionName);
  assert.equal(callsIdentifier(declaration, anonymousUserName), true, `${functionName} must establish anonymous Firebase Auth first`);

  const callableVariable = descendants(declaration).find((node) => node.type === "VariableDeclarator"
    && node.id.type === "Identifier"
    && node.init?.type === "CallExpression"
    && node.init.callee.type === "Identifier"
    && node.init.callee.name === httpsCallableName
    && node.init.arguments[1]?.type === "StringLiteral"
    && node.init.arguments[1].value === callableName);
  assert.ok(callableVariable, `${functionName} must create the ${callableName} server callable`);
  assert.equal(callsIdentifier(declaration, callableVariable.id.name), true, `${functionName} must invoke the ${callableName} callable`);
}

const clientProgram = parseTypeScript("../src/auth/studentAuth.ts");
const signInAnonymouslyName = importedBinding(clientProgram, "firebase/auth", "signInAnonymously");
const httpsCallableName = importedBinding(clientProgram, "firebase/functions", "httpsCallable");
assert.equal(callsIdentifier(functionDeclaration(clientProgram, "anonymousUser"), signInAnonymouslyName), true, "anonymousUser must call Firebase anonymous sign-in");
assertCallableContract(clientProgram, "prepareStudentLogin", "prepareStudentLogin", "anonymousUser", httpsCallableName);
assertCallableContract(clientProgram, "completeStudentLogin", "completeStudentLogin", "anonymousUser", httpsCallableName);

const browserForbiddenCollections = new Set(["studentRoster", "studentPinCredentials"]);
const forbiddenReference = descendants(clientProgram).find((node) => node.type === "StringLiteral" && browserForbiddenCollections.has(node.value));
assert.equal(forbiddenReference, undefined, "studentAuth.ts must not read roster or PIN credential collections in the browser");

const serverProgram = parseTypeScript("../functions/src/student-auth/callables.ts");
const rosterVerification = namedInitializer(serverProgram, "verifiedRosterStudent");
assert.equal(callsMethodWithString(rosterVerification, "collection", "studentRoster"), true, "roster verification must read studentRoster on the server");

const prepareLogin = namedInitializer(serverProgram, "prepareStudentLogin");
assert.equal(callsIdentifier(prepareLogin, "verifiedRosterStudent"), true, "prepareStudentLogin must verify the roster entry");
assert.equal(callsMethodWithString(prepareLogin, "collection", "studentPinCredentials"), true, "prepareStudentLogin must inspect the server-only PIN credential");

const completeLogin = namedInitializer(serverProgram, "completeStudentLogin");
assert.equal(callsIdentifier(completeLogin, "verifiedRosterStudent"), true, "completeStudentLogin must verify the roster entry");
assert.equal(callsMethodWithString(completeLogin, "collection", "studentPinCredentials"), true, "completeStudentLogin must verify the server-only PIN credential");
assert.equal(callsMethodWithString(completeLogin, "collection", "studentProfiles"), true, "completeStudentLogin must bind the verified identity to a UID profile");

console.log("student authentication contract tests passed");
