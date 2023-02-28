// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import {ChatClient} from '@kararty/dank-twitch-irc';

let chat_session: ChatClient | undefined;
let diag: vscode.DiagnosticCollection;
let diag_map: Map<string, vscode.Diagnostic[]> = new Map();

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "chat-helps" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('chat-helps.connect', () => {
		if (chat_session) {
			vscode.window.showInformationMessage("You're already connected, run chat-helps.disconnect to stop");
			return
		}

		chat_session = new ChatClient();
		chat_session.on("ready", () => vscode.window.showInformationMessage("Chat is connected and can help"));
		chat_session.on("close", (error) => {
			if (error != null) {
				vscode.window.showErrorMessage("Chat disconnected due to an error and can no longer help");
				console.error(error)
			} else {
				vscode.window.showInformationMessage("🦀 Chat is gone 🦀");
			}
		});
		chat_session.on("error", (error) => {
			vscode.window.showErrorMessage("whoopsie");
			console.error(error);
		});
		chat_session.on("PRIVMSG", (msg) => {
			console.log(msg);
			
			if (!msg.messageText.startsWith("help")) {
				return;
			}
			let words = msg.messageText.split(' ').slice(1);
			if (words.length < 4) {
				return;
			}

			let [file, line_str, type] = words.slice(0, 3);
			if (file.startsWith("/") || file.includes('..')) {
				return
			}
			let error_message = words.slice(3).join(' ');
			
			let line = Number.parseInt(line_str);
			let file_canonical = vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, file);
			let file_str = file_canonical.toString();
			let range = new vscode.Range(line-1, 0, line-1, 999);
			let severity: vscode.DiagnosticSeverity;
			switch (type) {
				case "err":
					severity = vscode.DiagnosticSeverity.Error
					break;
				case "hint":
					severity = vscode.DiagnosticSeverity.Hint
					break;
				case "warn":
					severity = vscode.DiagnosticSeverity.Warning
					break;
				case "info":
					severity = vscode.DiagnosticSeverity.Information
					break;
				default:
					return;
			}
			let err = new vscode.Diagnostic(range, error_message, severity)
			let existing = diag_map.get(file_str) || [];
			existing.push(err)
			diag_map.set(file_str, existing);
			diag.set(vscode.Uri.parse(file_str), existing);

			// Wait 30 seconds, then remove the error
			setTimeout(() => {
				let existing = diag_map.get(file_str) || [];
				existing = existing.filter((el) => el != err);
				diag_map.set(file_str, existing);
				diag.set(vscode.Uri.parse(file_str), existing);
		}, 30 * 1000)
		});

		vscode.window.showInputBox({ prompt: "Channel name to connect to?" }).then(channel_name => {
			if (!channel_name || chat_session == undefined) {
				chat_session = undefined;
				return;
			}
			chat_session.connect();
			void chat_session.join(channel_name)
		});
	});

	context.subscriptions.push(disposable);

	disposable = vscode.commands.registerCommand('chat-helps.disconnect', () => {
		chat_session.destroy(undefined);
		chat_session = undefined;
	});

	context.subscriptions.push(disposable);

	diag = vscode.languages.createDiagnosticCollection('chat');
	context.subscriptions.push(diag);
}

// This method is called when your extension is deactivated
export function deactivate() {
	if (chat_session) {
		chat_session = undefined;
	}
}
