<?php
/**
 * Plugin Name: Divi 5 Image to Layout
 * Description: Converte uno screenshot in una bozza layout compatibile con Divi (workflow assistito da AI).
 * Version: 0.1.0
 * Author: Codex Assistant
 * Requires at least: 6.0
 * Requires PHP: 8.0
 */

if (!defined('ABSPATH')) {
    exit;
}

define('DI2D5_PLUGIN_FILE', __FILE__);
define('DI2D5_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('DI2D5_PLUGIN_URL', plugin_dir_url(__FILE__));

require_once DI2D5_PLUGIN_DIR . 'includes/class-di2d5-service.php';
require_once DI2D5_PLUGIN_DIR . 'includes/class-di2d5-divi-builder.php';

class DI2D5_Plugin {
    public function __construct() {
        add_action('admin_menu', [$this, 'register_menu']);
        add_action('admin_enqueue_scripts', [$this, 'enqueue_assets']);
        add_action('rest_api_init', [$this, 'register_rest_routes']);
    }

    public function register_menu(): void {
        add_menu_page(
            'Divi Image to Layout',
            'Divi Image→Layout',
            'manage_options',
            'di2d5-generator',
            [$this, 'render_admin_page'],
            'dashicons-layout',
            58
        );
    }

    public function enqueue_assets(string $hook): void {
        if ($hook !== 'toplevel_page_di2d5-generator') {
            return;
        }

        wp_enqueue_script(
            'di2d5-admin',
            DI2D5_PLUGIN_URL . 'assets/js/admin.js',
            ['wp-api-fetch'],
            '0.1.0',
            true
        );

        wp_localize_script('di2d5-admin', 'di2d5Config', [
            'endpoint' => rest_url('di2d5/v1/generate'),
            'nonce' => wp_create_nonce('wp_rest'),
        ]);
    }

    public function register_rest_routes(): void {
        register_rest_route('di2d5/v1', '/generate', [
            'methods' => 'POST',
            'callback' => [$this, 'handle_generate'],
            'permission_callback' => function (): bool {
                return current_user_can('manage_options');
            },
        ]);
    }

    public function handle_generate(WP_REST_Request $request): WP_REST_Response {
        $image = $request->get_param('image');
        if (empty($image)) {
            return new WP_REST_Response(['message' => 'Immagine mancante.'], 400);
        }

        $api_key = get_option('di2d5_openai_api_key', '');
        if ($api_key === '') {
            return new WP_REST_Response(['message' => 'Imposta la API key nelle opzioni del plugin.'], 400);
        }

        $service = new DI2D5_Service($api_key);
        $spec = $service->generate_layout_spec($image);

        if (is_wp_error($spec)) {
            return new WP_REST_Response(['message' => $spec->get_error_message()], 500);
        }

        $builder = new DI2D5_Divi_Builder();
        $shortcode = $builder->build_shortcode($spec);

        return new WP_REST_Response([
            'spec' => $spec,
            'shortcode' => $shortcode,
            'message' => 'Bozza layout generata. Verifica e rifinisci i moduli in Divi Builder.',
        ]);
    }

    public function render_admin_page(): void {
        if (isset($_POST['di2d5_api_key']) && check_admin_referer('di2d5_save_settings')) {
            update_option('di2d5_openai_api_key', sanitize_text_field(wp_unslash($_POST['di2d5_api_key'])));
            echo '<div class="notice notice-success"><p>API key salvata.</p></div>';
        }

        $saved_api_key = esc_attr(get_option('di2d5_openai_api_key', ''));
        ?>
        <div class="wrap">
            <h1>Divi 5 Image → Layout (MVP)</h1>
            <p>Carica uno screenshot di riferimento e genera una bozza in formato moduli Divi.</p>

            <form method="post" style="max-width:640px;margin-bottom:24px;">
                <?php wp_nonce_field('di2d5_save_settings'); ?>
                <label for="di2d5_api_key"><strong>OpenAI API Key</strong></label>
                <input type="password" id="di2d5_api_key" name="di2d5_api_key" value="<?php echo $saved_api_key; ?>" class="regular-text" style="width:100%;margin-top:8px;">
                <p><button class="button button-primary" type="submit">Salva</button></p>
            </form>

            <div style="max-width:860px;">
                <label for="di2d5_image"><strong>Screenshot pagina (URL o base64 data URL)</strong></label>
                <textarea id="di2d5_image" rows="6" style="width:100%;margin-top:8px;" placeholder="https://example.com/screenshot.jpg"></textarea>
                <p>
                    <button id="di2d5_generate" class="button button-primary">Genera layout</button>
                </p>
                <h2>Output shortcode</h2>
                <textarea id="di2d5_output" rows="12" style="width:100%;font-family:monospace;" readonly></textarea>
                <p id="di2d5_status"></p>
            </div>
        </div>
        <?php
    }
}

new DI2D5_Plugin();
