import java.io.*;
import java.net.*;
import java.util.concurrent.*;

class Wlan {

    //    private static final String host = "192.168.4.1";
//    private static final int port = 23;
    private static final int timeout = 30;
    private static BufferedWriter writer;
    private static BufferedReader reader;
    private static String host;
    private static int port;
    private static Socket socket;
    private static boolean isCon = false;

    static void connect(String host, int port) throws IOException {
        if (socket != null && isConnected())
            return;
        Wlan.host = host;
        Wlan.port = port;
        System.out.println("Disconnected. Connecting to " + host + ":" + port + "...");
        try {
            if(!tryConnection()){
                //System.out.println("here");
                throw new ConnectException();

            }

            socket = new Socket(host, port);
        } catch (ConnectException e) {
            System.err.println("Unable to connect to host. retrying...");
            connect(host, port);
            return;
        }
        writer = new BufferedWriter(new OutputStreamWriter(socket.getOutputStream()));
        reader = new BufferedReader(new InputStreamReader(socket.getInputStream()));
        System.out.println("connected.");
        isCon = true;
    }

    static String receive() throws TimeoutException, NumberFormatException, IOException {

        ExecutorService executor = Executors.newSingleThreadExecutor();
        Future<String> future = executor.submit(new Task(reader));

        if (!isConnected()) {
            connect(host, port);
        }

        try {
            //System.out.println("Started..");
            String s = future.get(timeout, TimeUnit.SECONDS);
            if (s == null)
                throw new NumberFormatException("null timeout");
            return s;
        } catch (InterruptedException | ExecutionException e) {
            e.printStackTrace();
        }

        executor.shutdownNow();

        return null;
        //return reader.readLine();
    }

    static void transmit(String string) throws IOException {

        if (!isConnected()) {
            connect(host, port);
        }

        writer.write(string + "\n");
        writer.flush();
    }

    static boolean isConnected() {

        return isCon;
    }

    static boolean tryConnection() throws IOException {
        InetAddress address = InetAddress.getByName(host);
        //boolean reachable = address.isReachable(timeout);
        isCon = address.isReachable(timeout);
        //System.out.println("blubb");
        if(isCon){
            try (Socket ignored = new Socket(host, port)) {
                //System.out.println("true");
                return true;
            } catch (IOException ignored) {
                //System.out.println("false");
                isCon = false;
                return false;
            }
        }
        return false;
    }

    static void reconnect() throws IOException {
        connect(Wlan.host, Wlan.port);
    }
}
