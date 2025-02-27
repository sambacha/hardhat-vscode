import {
  CodeAction,
  CodeActionKind,
  Diagnostic,
  Range,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import {
  CompilerDiagnostic,
  HardhatCompilerError,
  ResolveActionsContext,
} from "../types";
import { attemptConstrainToFunctionName } from "../conversions/attemptConstrainToFunctionName";
import {
  parseFunctionDefinition,
  ParseFunctionDefinitionResult,
} from "./parsing/parseFunctionDefinition";
import { lookupToken } from "./parsing/lookupToken";

export class ConstrainMutability implements CompilerDiagnostic {
  public code = "2018";
  public blocks: string[] = [];

  fromHardhatCompilerError(
    document: TextDocument,
    error: HardhatCompilerError
  ): Diagnostic {
    return attemptConstrainToFunctionName(document, error);
  }

  resolveActions(
    diagnostic: Diagnostic,
    context: ResolveActionsContext
  ): CodeAction[] {
    const { document, uri } = context;

    if (!diagnostic.data) {
      return [];
    }

    const parseResult = parseFunctionDefinition(diagnostic, context);

    if (parseResult === null) {
      return [];
    }

    if (parseResult.functionDefinition.stateMutability === "view") {
      return this.modifyViewToPureAction(document, uri, parseResult);
    } else {
      return this.addMutabilityAction(diagnostic, document, uri, parseResult);
    }
  }

  private modifyViewToPureAction(
    document: TextDocument,
    uri: string,
    { functionSourceLocation, tokens }: ParseFunctionDefinitionResult
  ): CodeAction[] {
    const viewKeyword = tokens.find(
      (t) => t.type === "Keyword" && t.value === "view"
    );

    if (!viewKeyword || !viewKeyword.range) {
      return [];
    }

    const action: CodeAction = {
      title: "Change view modifier to pure in function declaration",
      kind: CodeActionKind.QuickFix,
      isPreferred: true,
      edit: {
        changes: {
          [uri]: [
            {
              range: Range.create(
                document.positionAt(
                  functionSourceLocation.start + viewKeyword.range[0]
                ),
                document.positionAt(
                  functionSourceLocation.start + viewKeyword.range[1]
                )
              ),
              newText: "pure",
            },
          ],
        },
      },
    };

    return [action];
  }

  private addMutabilityAction(
    diagnostic: Diagnostic,
    document: TextDocument,
    uri: string,
    {
      functionSourceLocation,
      tokens,
      functionDefinition,
    }: ParseFunctionDefinitionResult
  ): CodeAction[] {
    const modifier = diagnostic.message.includes("pure") ? "pure" : "view";
    const visibility = functionDefinition.visibility;

    const lookupResult = lookupToken(
      tokens,
      document,
      functionSourceLocation,
      (t) => t.type === "Keyword" && t.value === visibility
    );

    if (lookupResult === null) {
      return [];
    }

    const { token: visibilityKeyword, isSameLine } = lookupResult;

    if (visibilityKeyword.range === undefined) {
      return [];
    }

    const visibilityKeywordPosition = document.positionAt(
      functionSourceLocation.start + visibilityKeyword.range[0] + 1
    );

    const newText = isSameLine
      ? `${modifier} `
      : `${"".padStart(visibilityKeywordPosition.character - 1)}${modifier}\n`;

    const endOfVisibilityChar =
      functionSourceLocation.start + visibilityKeyword.range[1] + 1;

    const addMutabilityAction: CodeAction = {
      title: `Add ${modifier} modifier to function declaration`,
      kind: CodeActionKind.QuickFix,
      isPreferred: true,
      edit: {
        changes: {
          [uri]: [
            {
              range: Range.create(
                document.positionAt(endOfVisibilityChar),
                document.positionAt(endOfVisibilityChar)
              ),
              newText,
            },
          ],
        },
      },
    };

    return [addMutabilityAction];
  }
}
