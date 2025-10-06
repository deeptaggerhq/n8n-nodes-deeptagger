import {
	IAuthenticateGeneric,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class DeepTaggerApi implements ICredentialType {
	name = 'deepTaggerApi';
	displayName = 'DeepTagger API';
	documentationUrl = 'https://docs.deeptagger.com';
	properties: INodeProperties[] = [
		{
			displayName: 'Account ID',
			name: 'accountId',
			type: 'string',
			default: '',
			required: true,
			description: 'Your DeepTagger account ID',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'http://host.docker.internal:5050',
			required: true,
			description: 'DeepTagger API base URL (use host.docker.internal for local development)',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'x-consumer-username': '={{$credentials.accountId}}',
			},
		},
	};
}
