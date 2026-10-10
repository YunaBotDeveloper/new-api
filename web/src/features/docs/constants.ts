/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

// Placeholder model names used in copy-paste samples. Users pick real names
// from the Model Square; these only need to look plausible.
export const SAMPLE_CHAT_MODEL = 'gpt-5.5'
export const SAMPLE_IMAGE_MODEL = 'gpt-image-2'
export const SAMPLE_API_KEY_ENV = 'NEW_API_KEY'

// Endpoint types match the keys used by buildSample in pricing/lib/code-samples.
export const DOCS_SAMPLE_ENDPOINTS = [
  {
    type: 'openai',
    labelKey: 'Chat Completions',
    path: '/v1/chat/completions',
    model: SAMPLE_CHAT_MODEL,
  },
  {
    type: 'openai-response',
    labelKey: 'Responses',
    path: '/v1/responses',
    model: SAMPLE_CHAT_MODEL,
  },
  {
    type: 'anthropic',
    labelKey: 'Claude Messages',
    path: '/v1/messages',
    model: SAMPLE_CHAT_MODEL,
  },
  {
    type: 'image-generation',
    labelKey: 'Images',
    path: '/v1/images/generations',
    model: SAMPLE_IMAGE_MODEL,
  },
] as const

export const DOCS_ENDPOINTS = [
  {
    method: 'GET',
    path: '/v1/models',
    descriptionKey: 'List the models your API key can use',
  },
  {
    method: 'POST',
    path: '/v1/chat/completions',
    descriptionKey: 'OpenAI Chat Completions format',
  },
  {
    method: 'POST',
    path: '/v1/responses',
    descriptionKey: 'OpenAI Responses format',
  },
  {
    method: 'POST',
    path: '/v1/messages',
    descriptionKey: 'Anthropic Messages (Claude) format',
  },
  {
    method: 'POST',
    path: '/v1/images/generations',
    descriptionKey: 'Image generation',
  },
] as const

export const DOCS_ERRORS = [
  {
    code: '400',
    descriptionKey: 'Invalid request body or parameters',
  },
  {
    code: '401',
    descriptionKey: 'Missing or invalid API key',
  },
  {
    code: '403',
    descriptionKey:
      'The key cannot use this model or group, or your balance is exhausted',
  },
  {
    code: '429',
    descriptionKey: 'Too many requests. Slow down and retry later',
  },
  {
    code: '5xx',
    descriptionKey:
      'Upstream temporarily unavailable. Retry with exponential backoff',
  },
] as const
