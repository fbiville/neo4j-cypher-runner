import * as vscode from 'vscode';
import neo4j, { AuthToken, Driver } from 'neo4j-driver';

let driver: Driver;
let selectedDb: any;

export async function activate(context: vscode.ExtensionContext) {
	function getConfiguredDbs(): any[] {
		const config = vscode.workspace.getConfiguration('neo4j-cypher-runner');
		return config.get('databases') || [];
	}

	async function performDatabaseSelection() {
		const databases = getConfiguredDbs() || [];
		if (databases.length > 0) {
			const pickedConfig = await vscode.window.showQuickPick(
				databases.map(db => db.name),
				{
					canPickMany: false,
					title: 'Select Neo4j database',
				}
			);
			selectedDb = databases.find(db => db.name === pickedConfig);
			configureDriver();
		} else {
			vscode.window.showWarningMessage('No database configured');
		}
		
	}
	
	async function configureDriver () {
		if(driver) {
			await driver.close();
		}
		driver = neo4j.driver(selectedDb.url, selectedDb.authToken, { useBigInt: true });
	}

	console.log('Congratulations, your extension "neo4j-cypher-runner" is now active!');

	let disposable = vscode.commands.registerCommand('neo4j-cypher-runner.run-query', async () => {
		if (!driver) {
			await performDatabaseSelection();
		} 
		const document = vscode.window.activeTextEditor?.document;
		if (!document || !document?.fileName.endsWith('.cypher')) {
			return;
		}
		
		const query = document.getText();
		const session = driver.session({ database: selectedDb.database });
		try {
			const json: string = await session.writeTransaction(async tx => {
				const result = await tx.run(query);
				return JSON.stringify(
					result.records.map(x => x.toObject()),
					(_, value) => typeof value === 'bigint' ? `${value}n` : value,
					4
				);
			});

			const resultDocument = await vscode.workspace.openTextDocument({
				language: 'json',
				content: json
			});

			vscode.window.showTextDocument(resultDocument, 2, true);

		} finally {
			session.close();
		}

	});

	let disposableSelectDb = vscode.commands.registerCommand('neo4j-cypher-runner.select-database', performDatabaseSelection);

	context.subscriptions.push(disposable);
	context.subscriptions.push(disposableSelectDb);
}

export function deactivate() {
	driver.close()
		.catch(e => console.error('Error closing driver', e));
}
