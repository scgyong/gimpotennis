package kr.ac.tukorea.ge.scgyong.gtenn;

import android.util.Log;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.annotation.NonNull;

import java.util.ArrayList;

import kr.ac.tukorea.ge.scgyong.gtenn.databinding.AccountItemBinding;

public class TennisReservation {
    private static final String TAG = TennisReservation.class.getSimpleName();
    private static final String URL_LOGIN = "https://yeyak.guc.or.kr/member/login";
    private static final String URL_HOME = "https://yeyak.guc.or.kr/";
    public enum Phase {
        start, login,
    }
    private Phase phase;
    private final Account account;
    private final AccountItemBinding ui;

    public TennisReservation(Account account, AccountItemBinding binding) {
        this.account = account;
        this.ui = binding;
        phase = Phase.start;
    }

    public void start() {
        ui.webView.getSettings().setJavaScriptEnabled(true);
        ui.webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                Log.d(TAG, "onPageFinished: " + url + " @" + TennisReservation.this);
                ui.statusTextView.setText("Load: " + url);
                if (URL_LOGIN.equals(url)) {
                    login();
                }
                if (phase == Phase.login && URL_HOME.equals(url)) {
                    
                }
            }
        });
        ui.webView.loadUrl(URL_LOGIN);
    }

    private void login() {
        phase = Phase.login;
        String script =
            "document.getElementById('input_memid').value='" + account.id + "';\n" +
            "document.getElementById('input_mempw').value='" + account.password + "';\n" +
            "document.querySelector('input[tabindex=\"102\"]').click();\n";
        ui.webView.evaluateJavascript(script, null);
    }

    @NonNull
    @Override
    public String toString() {
        return "Reservation<" + account.id + ">";
    }
}
