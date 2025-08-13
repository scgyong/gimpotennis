package kr.ac.tukorea.ge.scgyong.gtenn;

import android.annotation.SuppressLint;
import android.content.Context;
import android.os.Bundle;
import android.view.MotionEvent;
import android.view.View;
import android.view.inputmethod.InputMethodManager;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.recyclerview.widget.RecyclerView;

import java.util.ArrayList;

import kr.ac.tukorea.ge.scgyong.gtenn.databinding.ActivityMainBinding;

public class MainActivity extends AppCompatActivity {

    protected ArrayList<Account> accounts = new ArrayList<>();
    protected ActivityMainBinding ui;

    @SuppressLint("ClickableViewAccessibility")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        adapter.loadAccounts(this);
        ui = ActivityMainBinding.inflate(getLayoutInflater());
        setContentView(ui.getRoot());
        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.main), (v, insets) -> {
            Insets systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            v.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom);
            return insets;
        });
        ui.recyclerView.setAdapter(adapter);
        ui.recyclerView.setOnTouchListener(onAdapterTouchListener);
    }
    @SuppressLint("ClickableViewAccessibility")
    View.OnTouchListener onAdapterTouchListener = (v, event) -> {
        if (event.getAction() != MotionEvent.ACTION_DOWN) return false;
        InputMethodManager imm = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
        View focusedView = getCurrentFocus();
        if (imm != null && focusedView != null) {
            imm.hideSoftInputFromWindow(focusedView.getWindowToken(), 0);
        }
        return false; // false: 터치 이벤트가 계속 전달되도록
    };

    AccountAdapter adapter = new AccountAdapter(accounts);

    public void onBtnAdd(View view) {
//        for (Account acnt : accounts) {
//            if (acnt.id.isEmpty() && acnt.password.isEmpty()) {
//                return;
//            }
//        }
        accounts.add(new Account());
        adapter.notifyItemInserted(accounts.size() - 1); // 해당 항목만 갱신
    }

    public void onBtnStart(View view) {
        for (int i = 0; i < accounts.size(); i++) {
            AccountAdapter.AccountViewHolder holder = (AccountAdapter.AccountViewHolder) ui.recyclerView.findViewHolderForAdapterPosition(i);
            Account acnt = accounts.get(i);
            new TennisReservation(acnt, holder.binding).start();
        }
    }
}