import java.io.*;
import java.util.concurrent.TimeoutException;

public class Main {
    private static int command_counter = 0;
    private static String file_origin = "";

    public static void main(String[] args) throws IOException, InterruptedException {
        if (args.length < 1) {
            System.out.println("missing ip:port");
            return;
        }
        if (args.length == 2) {
            file_origin = args[1];
        }
        System.out.println("Files located at: " + file_origin);
        final String[] split = args[0].split(":");
        if (split.length != 2) {
            System.out.println("missing ip or port");
            return;
        }

        Wlan.connect(split[0], Integer.parseInt(split[1]));
        initialize();
        while (true) {
            //System.out.println("round started!");
            initialize();
            if (!checkForCommands()) {
                Wlan.reconnect();
            }
            Thread.sleep(1000);
        }

    }

    private static boolean executeCommand(String cmd, int number) {

        initialize(); // check command has reset

        System.out.print("Sending command " + number + ": '" + cmd + "'. ");
        String[] split = cmd.split("@");
        try {

            try {
                for (String s : split) {
                    //System.out.println(s);
                    Wlan.transmit(s);
                }

            } catch (IOException e) {
                if (!Wlan.isConnected()) {
                    System.err.println("unable to send data. trying to reconnect...");
                    return false;
                }
                System.err.println("unable to send data. trying again...");
                //Thread.sleep(1000);
                return false;
            }
            System.out.print("sent. ");
            try {
                String answer = Wlan.receive();
                FileWriter fw = new FileWriter(file_origin + "frombot.txt", true);
                System.out.println("answer: '" + answer + "'");
                BufferedWriter bw = new BufferedWriter(fw);
                bw.write(number + ":" + answer + "\n");
                bw.close();
                command_counter++;
            } catch (TimeoutException e) {
                if (!Wlan.isConnected()) {
                    System.err.println("timeout. unable to recieve data. trying to reconnect...");
                    return false;
                }
                System.err.println("timeout. unable to recieve data. trying again...");
                return false;
            } catch (NumberFormatException e) { // null as answer: resend
                return false;
            }


        } catch (IOException e) {
            e.printStackTrace();
        }

        return true;
    }

    private static boolean checkForCommands() {

        String fileName = file_origin + "tobot.txt";
        String line;

        try {
            BufferedReader bufferedReader = new BufferedReader(new FileReader(fileName));
            int i = 0;
            while ((line = bufferedReader.readLine()) != null) {
                String[] parts = line.split(":");
                if ((++i) > command_counter) {
                    if (!executeCommand(parts[1], Integer.parseInt(parts[0]))) {
                        //System.out.println("random1");
                        return false;
                    }

                }

            }

            // Always close files.
            bufferedReader.close();
            //System.out.println("random2");
            return true;
        } catch (FileNotFoundException ex) {
            System.out.println(
                    "Unable to open file '" +
                            fileName + "'");
        } catch (IOException ex) {
            System.out.println(
                    "Error reading file '"
                            + fileName + "'");
            // Or we could just do this:
            // ex.printStackTrace();
        }
        return false;
    }

    private static void clearAll() throws FileNotFoundException {
        PrintWriter writer = new PrintWriter(file_origin + "tobot.txt");
        writer.print("");
        writer.close();
        writer = new PrintWriter(file_origin + "frombot.txt");
        writer.print("");
        writer.close();
    }

    private static void initialize() {
        String fileName = file_origin + "frombot.txt";
        String file2 = file_origin + "tobot.txt";
        int old = command_counter;
        int tobot = 0;
        try {
            BufferedReader bufferedReader = new BufferedReader(new FileReader(fileName));
            command_counter = 0;
            while ((bufferedReader.readLine()) != null) {
                command_counter++;

            }
            if (old != command_counter)
                System.err.println("Command count reset to: " + command_counter);
            bufferedReader.close();
            bufferedReader = new BufferedReader(new FileReader(file2));
            while ((bufferedReader.readLine()) != null) {
                tobot++;
            }
            if (tobot - command_counter > 10) {
                System.err.println("WARNING: " + (tobot - command_counter) + " commands behind schedule!");
                if (!Wlan.tryConnection()) {
                    System.err.println("Connection lost!");
                    Wlan.reconnect();
                }
            }

        } catch (FileNotFoundException e) {
            //todo create file here
            initialize();
        } catch (IOException e) {
            e.printStackTrace();
            // Or we could just do this:
            // ex.printStackTrace();
        }
    }
}
