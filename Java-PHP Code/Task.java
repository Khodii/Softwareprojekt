import java.io.BufferedReader;
import java.util.concurrent.Callable;

class Task implements Callable<String> {



    private BufferedReader reader;
    public Task(BufferedReader reader){
        this.reader = reader;
    }
    @Override
    public String call() throws Exception {
        return reader.readLine();
    }
}