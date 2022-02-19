import vscode from "vscode";
import { globals } from "./extension";
import { show_error_dialog } from "./vsc_utils";
import _ from "lodash";

export interface BuildError {
  type: "build-error";
  error: string;
}
export interface AnalysisError {
  type: "analysis-error";
  error: string;
}
interface FlowistryOutput<T> {
  type: "output";
  value: T;
}
export type FlowistryResult<T> =
  | FlowistryOutput<T>
  | BuildError
  | AnalysisError;

class ErrorProvider implements vscode.TextDocumentContentProvider {
  readonly uri = vscode.Uri.parse("flowistry://build-error");
  readonly eventEmitter = new vscode.EventEmitter<vscode.Uri>();
  contents: string = "";

  constructor(context: vscode.ExtensionContext) {
    context.subscriptions.push(
      vscode.workspace.registerTextDocumentContentProvider("flowistry", this)
    );
  }

  provideTextDocumentContent(_uri: vscode.Uri): vscode.ProviderResult<string> {
    return `Flowistry could not run because your project failed to build with error:\n${this.contents}`;
  }

  get onDidChange(): vscode.Event<vscode.Uri> {
    return this.eventEmitter.event;
  }
}

export class ErrorPane {
  showing: boolean = false;
  tdcp: ErrorProvider;
  doc: vscode.TextDocument;

  constructor(tdcp: ErrorProvider, doc: vscode.TextDocument) {
    this.tdcp = tdcp;
    this.doc = doc;
  }

  static load = async (
    context: vscode.ExtensionContext
  ): Promise<ErrorPane> => {
    let tdcp = new ErrorProvider(context);
    let doc = await vscode.workspace.openTextDocument(tdcp.uri);
    return new ErrorPane(tdcp, doc);
  };

  show = async (error: string) => {
    this.tdcp.contents = error;
    this.tdcp.eventEmitter.fire(this.tdcp.uri);
    if (!this.showing) {
      this.showing = true;
      await vscode.window.showTextDocument(this.doc, {
        viewColumn: vscode.ViewColumn.Beside,
        preserveFocus: true,
      });
    }
  };

  hide = async () => {
    if (this.showing) {
      this.showing = false;
      // TODO: can't figure out how to close the text editor...
      // goddamnit vscode

      // await vscode.window.showTextDocument(this.doc);
      // await vscode.commands.executeCommand(
      //   "workbench.action.closeActiveEditor"
      // );
    }
  };
}

export const show_error = async (error: BuildError | AnalysisError) => {
  if (error.type === "build-error") {
    await globals.error_pane.show(error.error);
  } else {
    await show_error_dialog(error.error);
  }
};

export let hide_error = () => globals.error_pane.hide();

export let ok = <T>(value: T): FlowistryResult<T> => ({
  type: "output",
  value,
});

export const is_ok = <T>(res: FlowistryResult<T>): res is FlowistryOutput<T> =>
  res.type === "output";
