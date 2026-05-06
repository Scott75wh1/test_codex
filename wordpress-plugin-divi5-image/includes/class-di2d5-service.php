<?php

if (!defined('ABSPATH')) {
    exit;
}

class DI2D5_Service {
    private string $api_key;

    public function __construct(string $api_key) {
        $this->api_key = $api_key;
    }

    public function generate_layout_spec(string $image_input) {
        $prompt = [
            'model' => 'gpt-4.1-mini',
            'response_format' => ['type' => 'json_object'],
            'messages' => [
                [
                    'role' => 'system',
                    'content' => 'Sei un assistente che converte screenshot web in JSON strutturato per moduli Divi. Ritorna solo JSON valido.',
                ],
                [
                    'role' => 'user',
                    'content' => [
                        [
                            'type' => 'text',
                            'text' => 'Analizza l\'immagine e produci: sections[] con rows[] e modules[]. Ogni module deve avere type (text|image|button|blurb|video|divider) e props.',
                        ],
                        [
                            'type' => 'image_url',
                            'image_url' => ['url' => $image_input],
                        ],
                    ],
                ],
            ],
            'temperature' => 0.2,
        ];

        $response = wp_remote_post('https://api.openai.com/v1/chat/completions', [
            'headers' => [
                'Authorization' => 'Bearer ' . $this->api_key,
                'Content-Type' => 'application/json',
            ],
            'timeout' => 60,
            'body' => wp_json_encode($prompt),
        ]);

        if (is_wp_error($response)) {
            return new WP_Error('di2d5_api_error', $response->get_error_message());
        }

        $status = wp_remote_retrieve_response_code($response);
        $body = json_decode(wp_remote_retrieve_body($response), true);

        if ($status < 200 || $status > 299) {
            $message = $body['error']['message'] ?? 'Errore API OpenAI';
            return new WP_Error('di2d5_api_http_error', $message);
        }

        $content = $body['choices'][0]['message']['content'] ?? '';
        $spec = json_decode($content, true);

        if (!is_array($spec) || !isset($spec['sections'])) {
            return new WP_Error('di2d5_invalid_spec', 'Formato JSON non valido o incompleto.');
        }

        return $spec;
    }
}
