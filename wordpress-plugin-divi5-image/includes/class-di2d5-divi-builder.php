<?php

if (!defined('ABSPATH')) {
    exit;
}

class DI2D5_Divi_Builder {
    public function build_shortcode(array $spec): string {
        $output = [];

        foreach ($spec['sections'] as $section) {
            $output[] = '[et_pb_section]';

            foreach (($section['rows'] ?? []) as $row) {
                $output[] = '[et_pb_row]';

                foreach (($row['modules'] ?? []) as $module) {
                    $output[] = $this->render_module($module);
                }

                $output[] = '[/et_pb_row]';
            }

            $output[] = '[/et_pb_section]';
        }

        return implode("\n", $output);
    }

    private function render_module(array $module): string {
        $type = $module['type'] ?? 'text';
        $props = $module['props'] ?? [];

        switch ($type) {
            case 'image':
                $src = esc_url_raw($props['src'] ?? '');
                $alt = esc_attr($props['alt'] ?? '');
                return sprintf('[et_pb_image src="%s" alt="%s"][/et_pb_image]', $src, $alt);

            case 'button':
                $text = esc_attr($props['text'] ?? 'Click');
                $url = esc_url_raw($props['url'] ?? '#');
                return sprintf('[et_pb_button button_text="%s" button_url="%s"][/et_pb_button]', $text, $url);

            case 'blurb':
                $title = esc_attr($props['title'] ?? 'Titolo');
                $body = wp_kses_post($props['body'] ?? '');
                return sprintf('[et_pb_blurb title="%s"]%s[/et_pb_blurb]', $title, $body);

            case 'video':
                $src = esc_url_raw($props['src'] ?? '');
                return sprintf('[et_pb_video src="%s"][/et_pb_video]', $src);

            case 'divider':
                return '[et_pb_divider][/et_pb_divider]';

            case 'text':
            default:
                $body = wp_kses_post($props['content'] ?? '');
                return sprintf('[et_pb_text]%s[/et_pb_text]', $body);
        }
    }
}
