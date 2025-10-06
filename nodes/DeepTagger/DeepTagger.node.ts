import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

export class DeepTagger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'DeepTagger',
		name: 'deepTagger',
		icon: 'file:deeptagger.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Extract structured data from documents using DeepTagger',
		defaults: {
			name: 'DeepTagger',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'deepTaggerApi',
				required: false,
			},
		],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Extract Data',
						value: 'extractData',
						description: 'Extract structured data from a document',
						action: 'Extract data from document',
					},
				],
				default: 'extractData',
			},
			{
				displayName: 'Authentication Mode',
				name: 'authMode',
				type: 'options',
				options: [
					{
						name: 'Credentials',
						value: 'credentials',
						description: 'Use saved credentials',
					},
					{
						name: 'Direct',
						value: 'direct',
						description: 'Enter account ID directly (for testing)',
					},
				],
				default: 'direct',
				description: 'How to authenticate with DeepTagger API',
			},
			{
				displayName: 'Account ID',
				name: 'accountId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						authMode: ['direct'],
					},
				},
				description: 'DeepTagger account ID',
			},
			{
				displayName: 'Base URL',
				name: 'baseUrl',
				type: 'string',
				default: 'http://host.docker.internal:5050',
				required: true,
				displayOptions: {
					show: {
						authMode: ['direct'],
					},
				},
				description: 'DeepTagger API base URL',
			},
			{
				displayName: 'Folder ID',
				name: 'folderId',
				type: 'string',
				default: '',
				required: true,
				description: 'DeepTagger folder (project) ID',
			},
			{
				displayName: 'Input Type',
				name: 'inputType',
				type: 'options',
				options: [
					{
						name: 'Text',
						value: 'text',
					},
					{
						name: 'File',
						value: 'file',
					},
				],
				default: 'text',
				description: 'Type of input to send',
			},
			{
				displayName: 'Text',
				name: 'text',
				type: 'string',
				typeOptions: {
					rows: 5,
				},
				default: '',
				displayOptions: {
					show: {
						inputType: ['text'],
					},
				},
				description: 'Text content to extract data from',
			},
			{
				displayName: 'Binary Property',
				name: 'binaryProperty',
				type: 'string',
				default: 'data',
				displayOptions: {
					show: {
						inputType: ['file'],
					},
				},
				required: true,
				description: 'Name of the binary property containing the file',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const operation = this.getNodeParameter('operation', i) as string;
				const authMode = this.getNodeParameter('authMode', i) as string;
				const folderId = this.getNodeParameter('folderId', i) as string;
				const inputType = this.getNodeParameter('inputType', i) as string;

				// Get auth details
				let accountId: string;
				let baseUrl: string;

				if (authMode === 'credentials') {
					const credentials = await this.getCredentials('deepTaggerApi');
					accountId = credentials.accountId as string;
					baseUrl = credentials.baseUrl as string;
				} else {
					accountId = this.getNodeParameter('accountId', i) as string;
					baseUrl = this.getNodeParameter('baseUrl', i) as string;
				}

				if (operation === 'extractData') {
					let response;

					if (inputType === 'text') {
						const text = this.getNodeParameter('text', i) as string;

						response = await this.helpers.request({
							method: 'POST',
							url: `${baseUrl}/v1/extract_data`,
							headers: {
								'x-consumer-username': accountId,
								'Content-Type': 'application/x-www-form-urlencoded',
							},
							form: {
								fo_id: folderId,
								text: text,
							},
							json: true,
						});
					} else {
						// Handle file input
						const binaryPropertyName = this.getNodeParameter('binaryProperty', i) as string;
						const binaryData = this.helpers.assertBinaryData(i, binaryPropertyName);
						const buffer = await this.helpers.getBinaryDataBuffer(i, binaryPropertyName);

						response = await this.helpers.request({
							method: 'POST',
							url: `${baseUrl}/v1/extract_data`,
							headers: {
								'x-consumer-username': accountId,
							},
							formData: {
								fo_id: folderId,
								file: {
									value: buffer,
									options: {
										filename: binaryData.fileName || 'document',
										contentType: binaryData.mimeType,
									},
								},
							},
							json: true,
						});
					}

					returnData.push({
						json: response,
						pairedItem: { item: i },
					});
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: error.message,
						},
						pairedItem: { item: i },
					});
					continue;
				}
				throw new NodeOperationError(this.getNode(), error as Error, {
					itemIndex: i,
				});
			}
		}

		return [returnData];
	}
}
