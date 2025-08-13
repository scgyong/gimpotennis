package kr.ac.tukorea.ge.scgyong.gtenn;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.JsonReader;
import android.util.Log;
import android.view.LayoutInflater;
import android.view.ViewGroup;
import android.view.inputmethod.EditorInfo;
import android.widget.EditText;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;

import kr.ac.tukorea.ge.scgyong.gtenn.databinding.AccountItemBinding;

public class AccountAdapter extends RecyclerView.Adapter<AccountAdapter.AccountViewHolder> {
    protected ArrayList<Account> accountList;

    public AccountAdapter(ArrayList<Account> accountList) {
        this.accountList = accountList;
    }

    public class AccountViewHolder extends RecyclerView.ViewHolder {
        AccountItemBinding binding;

        public AccountViewHolder(AccountItemBinding binding) {
            super(binding.getRoot());
            this.binding = binding;
            processEditText(binding.idEditText);
            processEditText(binding.pwEditText);
        }

        protected void processEditText(EditText editText) {
            // 1. 키보드 완료 버튼 처리
            editText.setOnEditorActionListener((v, actionId, event) -> {
                if (actionId == EditorInfo.IME_ACTION_DONE) {
                    editText.clearFocus(); // 포커스를 제거하면 아래 onFocusChange가 트리거됨
                    return true;
                }
                return false;
            });

            // 2. 포커스를 잃었을 때 처리 (onBlur)
            editText.setOnFocusChangeListener((v, hasFocus) -> {
                if (!hasFocus) readFromEdits();
            });
        }

        private void readFromEdits() {
            int pos = getAdapterPosition();
            if (pos >= accountList.size() || pos < 0) {
                Log.w("AccountAdapter", "pos=" + pos + " while accountList.size()=" + accountList.size());
                return;
            }
            Account acnt = accountList.get(pos);
            String id = binding.idEditText.getText().toString().trim();
            String pw = binding.pwEditText.getText().toString();
            if (id.isEmpty()) {
                accountList.remove(pos);
                saveAccounts(binding.idEditText.getContext());
                notifyItemRemoved(pos);
                return;
            }
            if (acnt.id.equals(id) && acnt.password.equals(pw)) {
                return;
            }
            acnt.id = id;
            acnt.password = pw;
            saveAccounts(binding.idEditText.getContext());
        }
    }

    public void saveAccounts(Context context) {
        StringBuilder sb = new StringBuilder();
        sb.append('[');
        boolean comma = false;
        for (Account acnt: accountList) {
            if (comma) sb.append(',');
            sb.append(acnt.toJsonString());
            comma = true;
        }
        sb.append(']');
        SharedPreferences prefs = context.getSharedPreferences("PREFS", Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = prefs.edit();
        editor.putString("accounts", sb.toString());
        Log.d("AccountAdapter", sb.toString());
        editor.commit();
    }

    public void loadAccounts(Context context) {
        SharedPreferences prefs = context.getSharedPreferences("PREFS", Context.MODE_PRIVATE);
        String value = prefs.getString("accounts", "[]");
        Log.d("AcountAdapter", value);

        try {
            ArrayList<Account> accounts = new ArrayList<>();
            InputStream inputStream = new ByteArrayInputStream(value.getBytes(StandardCharsets.UTF_8));
            JsonReader jr = new JsonReader(new InputStreamReader(inputStream));
            jr.beginArray();
            while (jr.hasNext()) {
                Account acnt = new Account();
                jr.beginObject();
                while (jr.hasNext()) {
                    String name = jr.nextName();
                    if (name.equals("id")) {
                        acnt.id = jr.nextString();
                    } else if (name.equals("pw")) {
                        acnt.password = jr.nextString();
                    } else {
                        jr.skipValue();
                    }
                }
                jr.endObject();
                if (acnt.id.isEmpty() && acnt.password.isEmpty()) continue;
                accounts.add(acnt);
            }
            jr.endArray();
            jr.close();
            inputStream.close();
            if (!accounts.isEmpty()) {
                accountList.clear();
                accountList.addAll(accounts);
                notifyDataSetChanged();
            }
            Log.d("AcountAdapter", "size=" + accountList.size());
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @NonNull
    @Override
    public AccountViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        LayoutInflater inflater = LayoutInflater.from(parent.getContext());
        AccountItemBinding binding = AccountItemBinding.inflate(inflater, parent, false);
        return new AccountViewHolder(binding);
    }

    @Override
    public void onBindViewHolder(@NonNull AccountViewHolder holder, int position) {
        Account acnt = accountList.get(position);
        holder.binding.idEditText.setText(acnt.id);
        holder.binding.pwEditText.setText(acnt.password);
    }

    @Override
    public int getItemCount() {
        return accountList.size();
    }
}
