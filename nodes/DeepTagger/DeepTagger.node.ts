import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

// Use global Buffer (no import needed - available in Node.js runtime)
declare const Buffer: typeof import('buffer').Buffer;

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
				required: true,
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
				displayName: 'Project ID',
				name: 'projectId',
				type: 'string',
				default: '',
				required: true,
				description: 'DeepTagger project ID (e.g., fo_1759714105892)',
				hint: 'Browse your projects at https://deeptagger.com/das/fos, then open a project to find its ID in the URL',
			},
			{
				displayName: 'Input Type',
				name: 'inputType',
				type: 'options',
				options: [
					{
						name: 'File',
						value: 'file',
					},
					{
						name: 'Text',
						value: 'text',
					},
				],
				default: 'file',
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
			{
				displayName: 'Unwrap Response',
				name: 'unwrapResponse',
				type: 'boolean',
				default: true,
				description: 'Whether to return only the extracted data (unwrapped) or the full response including metadata',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const operation = this.getNodeParameter('operation', i) as string;
				const projectId = this.getNodeParameter('projectId', i) as string;
				const inputType = this.getNodeParameter('inputType', i) as string;
				const unwrapResponse = this.getNodeParameter('unwrapResponse', i) as boolean;

				// Get credentials
				const credentials = await this.getCredentials('deepTaggerApi');
				const baseUrl = credentials.baseUrl as string;

				if (operation === 'extractData') {
					let response;

					if (inputType === 'text') {
						const text = this.getNodeParameter('text', i) as string;

						// Convert to form-urlencoded string
						const formBody = `fo_id=${encodeURIComponent(projectId)}&text=${encodeURIComponent(text)}`;

						// Use httpRequestWithAuthentication - credentials will add x-api-key header automatically
						response = await this.helpers.httpRequestWithAuthentication.call(
							this,
							'deepTaggerApi',
							{
								method: 'POST',
								url: `${baseUrl}/extract_data`,
								headers: {
									'Content-Type': 'application/x-www-form-urlencoded',
								},
								body: formBody,
							},
						);
					} else {
						// Handle file input
						const binaryPropertyName = this.getNodeParameter('binaryProperty', i) as string;
						const binaryData = this.helpers.assertBinaryData(i, binaryPropertyName);
						const buffer = await this.helpers.getBinaryDataBuffer(i, binaryPropertyName);

						// Manually construct multipart/form-data (no dependencies allowed for n8n Cloud)
						const boundary = `----WebKitFormBoundary${Math.random().toString(36).substring(2)}`;
						const parts: any[] = [];

						// Add fo_id field
						parts.push(Buffer.from(
							`--${boundary}\r\n` +
							`Content-Disposition: form-data; name="fo_id"\r\n\r\n` +
							`${projectId}\r\n`
						));

						// Add file field
						parts.push(Buffer.from(
							`--${boundary}\r\n` +
							`Content-Disposition: form-data; name="file"; filename="${binaryData.fileName || 'document'}"\r\n` +
							`Content-Type: ${binaryData.mimeType || 'application/octet-stream'}\r\n\r\n`
						));
						parts.push(buffer);
						parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

						const body = Buffer.concat(parts);

						// Use httpRequestWithAuthentication - credentials will add x-api-key header automatically
						response = await this.helpers.httpRequestWithAuthentication.call(
							this,
							'deepTaggerApi',
							{
								method: 'POST',
								url: `${baseUrl}/extract_data`,
								headers: {
									'Content-Type': `multipart/form-data; boundary=${boundary}`,
								},
								body: body,
							},
						);
					}

					// Unwrap response if enabled (default behavior)
					let jsonData = response;
					if (unwrapResponse && response && typeof response === 'object' && 'data' in response) {
						jsonData = response.data;
					}

					returnData.push({
						json: jsonData,
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
