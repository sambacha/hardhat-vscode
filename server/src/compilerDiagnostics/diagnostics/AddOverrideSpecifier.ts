import { CodeAction, Diagnostic } from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import {
  CompilerDiagnostic,
  HardhatCompilerError,
  ResolveActionsContext,
} from "../types";
import { attemptConstrainToFunctionName } from "../conversions/attemptConstrainToFunctionName";
import { resolveInsertSpecifierQuickFix } from "./common/resolveInsertSpecifierQuickFix";

export class AddOverrideSpecifier implements CompilerDiagnostic {
  public code = "9456";
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
    return resolveInsertSpecifierQuickFix("override", diagnostic, context);
  }
}
