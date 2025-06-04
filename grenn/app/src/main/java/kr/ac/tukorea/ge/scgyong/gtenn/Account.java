package kr.ac.tukorea.ge.scgyong.gtenn;

public class Account {
    public String id = "";
    public String password = "";

    public String toJsonString() {
        String encoded_id = id.replace("\\", "\\\\").replace("\"", "\\\"");
        String encoded_pw = password.replace("\\", "\\\\").replace("\"", "\\\"");
        return "{\"id\":\"" + encoded_id + "\",\"pw\":\"" + encoded_pw + "\"}";
    }
}
